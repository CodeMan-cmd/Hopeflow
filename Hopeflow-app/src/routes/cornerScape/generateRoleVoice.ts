import express from "express";
import pLimit from "p-limit";
import u from "@/utils";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { transform } from "sucrase";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

// 生成角色独有音色：
// - reference 模式（默认）：参考音频克隆角色独有声音（走 TTS 供应商），需 model + 参考音色
// - text 模式：DashScope 文生音色（文字描述直接生成定制音色 mp3），需 voicePrompts
// 两种模式最终均落为一条音频资产并自动绑定角色（一角色一音色）
export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    model: z.string().optional(), // reference 模式必填
    roleIds: z.array(z.number()),
    concurrentCount: z.number().min(1).optional(),
    referenceAudios: z.record(z.string(), z.string()).optional(),
    sampleText: z.string().optional(),
    voiceSource: z.enum(["reference", "text"]).optional(),
    voicePrompts: z.record(z.string(), z.string()).optional(),
  }),
  async (req, res) => {
    const { projectId, model, roleIds, concurrentCount, referenceAudios, sampleText, voiceSource = "reference", voicePrompts } = req.body;
    const isTextMode = voiceSource === "text";

    // 1. 校验角色资产
    const roles = (await u
      .db("o_assets")
      .whereIn("id", roleIds)
      .andWhere("projectId", projectId)
      .andWhere("type", "role")
      .select("id", "name")) as { id: number; name: string }[];
    if (roles.length === 0) return res.status(400).send(error("所选角色不存在"));

    if (!isTextMode && !model) return res.status(400).send(error("参考音频克隆模式需要选择配音模型"));

    // 2. reference 模式：预取角色已绑定音频（父音频资产）
    const binds = await u
      .db("o_assetsRole2Audio")
      .leftJoin("o_assets", "o_assets.id", "o_assetsRole2Audio.assetsAudioId")
      .whereIn("o_assetsRole2Audio.assetsRoleId", roles.map((r: any) => r.id))
      .select("o_assetsRole2Audio.assetsRoleId", "o_assets.id");
    const boundMap: Record<number, number> = {};
    binds.forEach((b: any) => {
      if (b.id) boundMap[b.assetsRoleId] = b.id;
    });

    // 读取参考音色 base64：前端上传 > 已绑定音频
    async function getReferenceBase64(roleId: number): Promise<string | null> {
      const uploaded = referenceAudios?.[String(roleId)];
      if (uploaded) return uploaded;
      const boundParentId = boundMap[roleId];
      if (boundParentId) {
        const child = await u.db("o_assets").where("assetsId", boundParentId).select("imageId").first();
        const image = child?.imageId ? await u.db("o_image").where("id", child.imageId).select("filePath").first() : null;
        if (image?.filePath) {
          try {
            const buf = await u.oss.getFile(image.filePath);
            return `data:audio/mpeg;base64,${buf.toString("base64")}`;
          } catch (e) {
            console.error(`[generateRoleVoice] 读取角色 ${roleId} 已绑定音频失败:`, e);
          }
        }
      }
      return null;
    }

    // 3. text 模式：读取 DashScope 供应商 API Key
    let dashscopeApiKey = "";
    if (isTextMode) {
      const dashscope = await u.db("o_vendorConfig").where("id", "dashscope").select("inputValues").first();
      dashscopeApiKey = (JSON.parse(dashscope?.inputValues ?? "{}") as Record<string, string>).apiKey?.trim() ?? "";
      if (!dashscopeApiKey) return res.status(400).send(error("未配置 DashScope API Key，请先在设置中心配置"));
    }

    // 4. 预校验：reference 模式缺参考音色 / text 模式缺音色描述的角色跳过
    const processable: { role: (typeof roles)[number]; ref?: string; voicePrompt?: string }[] = [];
    const skipped: { roleId: number; roleName: string; reason: string }[] = [];
    for (const role of roles) {
      if (isTextMode) {
        const voicePrompt = voicePrompts?.[String(role.id)]?.trim();
        if (!voicePrompt) {
          skipped.push({ roleId: role.id, roleName: role.name ?? "", reason: "缺少音色描述" });
          continue;
        }
        processable.push({ role, voicePrompt });
      } else {
        const ref = await getReferenceBase64(role.id);
        if (!ref) {
          skipped.push({ roleId: role.id, roleName: role.name ?? "", reason: "缺少参考音色" });
          continue;
        }
        processable.push({ role, ref });
      }
    }

    if (processable.length === 0) {
      const reasons = [...new Set(skipped.map((s) => s.reason))].join("、");
      return res.status(400).send(error(`所选角色均无法生成独有音色：${reasons || "缺少生成条件"}`));
    }

    // 5. 落库并绑定角色：父音频资产 + 子资产 + o_image + o_assetsRole2Audio（与资产中心配音结构一致）
    // 音频文件已由调用方写入 oss，此处仅记录资产与绑定
    async function persistRoleVoice(role: (typeof roles)[number], sample: string, audioPath: string) {
      const [parentId] = await u.db("o_assets").insert({
        name: `${role.name ?? "角色"}独有音色`,
        describe: `${role.name ?? "角色"}独有音色（${sample.slice(0, 30)}）`,
        type: "audio",
        projectId,
        startTime: Date.now(),
      });
      const [assetsId] = await u.db("o_assets").insert({
        prompt: sample,
        assetsId: parentId,
        type: "audio",
        describe: sample,
        name: `${role.name ?? "角色"}独有音色`,
        projectId,
        startTime: Date.now(),
      });
      const [imageId] = await u.db("o_image").insert({
        filePath: audioPath,
        type: "audio",
        assetsId,
        state: "已完成",
      });
      await u.db("o_assets").where("id", assetsId).update({ imageId });

      // 绑定到角色（一角色一音色）
      await u.db("o_assetsRole2Audio").where("assetsRoleId", role.id).delete();
      await u.db("o_assetsRole2Audio").insert({ assetsRoleId: role.id, assetsAudioId: parentId });
    }

    // 6. 后台并发生成（不阻塞响应）
    const limit = pLimit(concurrentCount ?? 1);

    processable.forEach((item) => {
      limit(async () => {
        const { role } = item;
        await u.db("o_assets").where("id", role.id).update("audioBindState", "生成中");
        try {
          // 每个角色仅生成一条独有音色样本：默认用角色名开场白，也支持自定义样本文本
          const sample = sampleText?.trim() || `你好，我是${role.name ?? "本角色"}，这是我的声音。`;
          if (isTextMode) {
            // 文生音色：DashScope Voice Design → mp3 试听音频
            const code = u.vendor.getCode("dashscope");
            const jsCode = transform(code, { transforms: ["typescript"] }).code;
            const running = u.vm(jsCode);
            const { audioBase64 } = await running.voiceDesign({
              apiKey: dashscopeApiKey,
              voicePrompt: item.voicePrompt!,
              previewText: sample,
              responseFormat: "mp3",
            });
            const audioPath = `/${projectId}/assets/audio/${uuidv4()}.mp3`;
            // writeFile 对 string 自动剥离 data URL 头并按 base64 写入
            await u.oss.writeFile(audioPath, audioBase64);
            await persistRoleVoice(role, sample, audioPath);
          } else {
            // 参考音频克隆：TTS 供应商生成角色独有声音
            const ai = u.Ai.Audio(model!);
            await ai.run(
              {
                text: sample,
                voice: "reference",
                referenceList: [{ type: "audio", base64: item.ref }],
              },
              {
                taskClass: "TTS配音生成",
                describe: `${role.name ?? "角色"}独有音色：${sample.slice(0, 30)}`,
                projectId,
                relatedObjects: JSON.stringify({ roleId: role.id, projectId, type: "dubbing" }),
              },
            );
            const audioPath = `/${projectId}/assets/audio/${uuidv4()}.wav`;
            await ai.save(audioPath);
            await persistRoleVoice(role, sample, audioPath);
          }
          await u.db("o_assets").where("id", role.id).update("audioBindState", "已完成");
        } catch (e) {
          console.error(`[generateRoleVoice] 角色 ${role.id} 独有音色生成失败:`, e);
          await u.db("o_assets").where("id", role.id).update("audioBindState", "生成失败");
        }
      });
    });

    res.status(200).send(success({ message: "独有音色生成任务已提交", total: processable.length, skipped }));
  },
);
