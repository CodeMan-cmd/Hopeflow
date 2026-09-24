import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { classifyError } from "@/utils/errorClassify";
const router = express.Router();

/**
 * 敏感词失败的自愈入口。
 *
 * 现场问题：供应商侧的过滤是「关键词级且确定性」的，但平台只甩一句
 * 「提示词包含平台安全审核限制的内容，请调整画面描述后重试」，
 * 要用户自己去猜是哪个词——35 个分镜里 19 个反复失败，只能到外面写脚本二分定位。
 *
 * 这里提供两个动作，对应两种真实需求：
 * - addRule：把疑似触发词一键写入该供应商的敏感词替换规则（`o_vendorSafetyReplacements`），一次配置长期生效；
 * - rewrite：让文本模型在**保持画面内容不变**的前提下改写这段提示词，规避触发词。
 */
export default router.post(
  "/",
  validateFields({
    storyboardIds: z.array(z.number()),
    action: z.enum(["preview", "addRule", "rewrite", "both"]),
    word: z.string().optional(),
    replaceTo: z.string().optional(),
  }),
  async (req, res) => {
    const { storyboardIds, action, word, replaceTo } = req.body as {
      storyboardIds: number[];
      action: "preview" | "addRule" | "rewrite" | "both";
      word?: string;
      replaceTo?: string;
    };
    if (!storyboardIds?.length) return res.status(400).send(error("storyboardIds 不能为空"));

    const rows = await u.db("o_storyboard").whereIn("id", storyboardIds).select("id", "prompt", "reason", "projectId");
    if (!rows.length) return res.status(400).send(error("未查询到分镜数据"));

    // ---- 预览：只反推疑似触发词，方便前端在弹窗里预填，不产生任何副作用 ----
    if (action === "preview") {
      const candidates = new Map<string, string>();
      for (const row of rows) {
        const cls = classifyError(row.reason ?? "", { prompt: row.prompt ?? undefined });
        for (const s of cls.safetySuggestions ?? []) candidates.set(s.from, s.to);
      }
      return res.status(200).send(
        success({
          count: rows.length,
          candidates: [...candidates.entries()].map(([from, to]) => ({ from, to })),
        }),
      );
    }

    const projectId = rows[0].projectId as number;
    const project = await u.db("o_project").where("id", projectId).select("imageModel").first();
    const vendorId = String(project?.imageModel ?? "").split(/:(.+)/)[0];

    const result: {
      ruleAdded: { vendorId: string; replaceFrom: string; replaceTo: string }[];
      rewritten: { id: number; prompt: string }[];
      failed: { id: number; message: string }[];
    } = { ruleAdded: [], rewritten: [], failed: [] };

    // ---- 动作 1：写入替换规则 ----
    // 注意：没识别到触发词时不报错，直接退化成「只做 AI 改写」。
    // 否则用户会卡在「不知道是哪个词」的死角里，那正是这次要解决的现场问题。
    const wantRule = action === "addRule" || action === "both";
    const from = String(word ?? "").trim();
    const ruleSkipped = wantRule && !from;
    if (wantRule && from) {
      const to =
        String(replaceTo ?? "").trim() ||
        classifyError("敏感词", {}).safetySuggestions?.find((s) => s.from === from)?.to ||
        "";
      if (!to) return res.status(400).send(error(`请为「${from}」填写替换词`));

      // 触发词规则是「按供应商」生效的：落到项目图像模型所属供应商；
      // 拿不到归属时退化为给所有启用供应商都加一遍（与页面里手工添加的效果一致）。
      let vendorIds: string[] = vendorId ? [vendorId] : [];
      if (!vendorIds.length) {
        const enabled = await u.db("o_vendorConfig").where("enable", 1).select("id");
        vendorIds = enabled.map((v: any) => String(v.id));
      }

      for (const vid of vendorIds) {
        const exists = await u.db("o_vendorSafetyReplacements").where({ vendorId: vid, replaceFrom: from }).first();
        if (exists) {
          result.ruleAdded.push({ vendorId: vid, replaceFrom: from, replaceTo: String(exists.replaceTo ?? "") });
          continue;
        }
        const now = Date.now();
        await u.db("o_vendorSafetyReplacements").insert({
          vendorId: vid,
          replaceFrom: from,
          replaceTo: to,
          enabled: 1,
          createTime: now,
          updateTime: now,
        });
        result.ruleAdded.push({ vendorId: vid, replaceFrom: from, replaceTo: to });
      }

      // 规则写完后，历史失败的分镜可以直接重试了，把它们从「生成失败」放回「未生成」
      await u
        .db("o_storyboard")
        .whereIn(
          "id",
          rows.filter((r: any) => classifyError(r.reason ?? "").type === "safety").map((r: any) => r.id),
        )
        .update({ state: "未生成", reason: null, errorType: null });
    }

    // ---- 动作 2：AI 改写规避 ----
    if (action === "rewrite" || action === "both" || ruleSkipped) {
      const system = [
        "你是短视频分镜提示词的合规改写助手。",
        "任务：在**完全保持**画面内容、主体、动作、镜头、构图、光影、情绪、风格的前提下，",
        "把可能触发平台内容安全审核的用词替换成语义等价、安全的表达。",
        "要求：",
        "1. 不要删减画面元素，不要改变叙事意图，不要新增剧情；",
        "2. 优先做同义替换与措辞中性化（如把具体敏感物件换成其功能/形态描述）；",
        "3. 只输出改写后的提示词本身，不要解释、不要加引号、不要输出多段。",
      ].join("\n");

      for (const row of rows) {
        const original = String(row.prompt ?? "").trim();
        if (!original) {
          result.failed.push({ id: row.id as number, message: "原提示词为空，无法改写" });
          continue;
        }
        const cls = classifyError(row.reason ?? "");
        const wordHint = cls.safetyWords.length ? `\n已知疑似触发词：${cls.safetyWords.join("、")}` : "";
        try {
          const { _output } = (await u.Ai.Text("universalAi").invoke({
            system,
            messages: [{ role: "user", content: `原提示词：\n${original}${wordHint}` }],
          })) as any;
          const next = String(_output ?? "").trim();
          if (!next) {
            result.failed.push({ id: row.id as number, message: "模型返回空内容" });
            continue;
          }
          await u.db("o_storyboard").where("id", row.id).update({
            prompt: next,
            state: "未生成",
            reason: null,
            errorType: null,
          });
          result.rewritten.push({ id: row.id as number, prompt: next });
        } catch (e: any) {
          result.failed.push({ id: row.id as number, message: u.error(e).message });
        }
      }
    }

    res.status(200).send(
      success({
        ...result,
        /** 没识别到触发词、只做了改写时告知前端，便于给出口径一致的提示 */
        ruleSkipped,
      }),
    );
  },
);
