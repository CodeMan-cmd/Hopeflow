import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { classifyError, type ErrorType } from "@/utils/errorClassify";
const router = express.Router();

type StageState = "empty" | "pending" | "partial" | "done" | "failed";

interface Stage {
  key: string;
  label: string;
  state: StageState;
  done: number;
  total: number;
  detail: string;
  /** 该阶段对应的画布节点 id，界面据此提供「去这一步」 */
  node: string;
}

interface Blocker {
  code: string;
  message: string;
  stage: string;
  node: string;
  actionLabel: string;
}

function stage(key: string, label: string, node: string, done: number, total: number, detail: string, failed = 0): Stage {
  let state: StageState;
  if (total === 0) state = "empty";
  else if (done >= total) state = failed > 0 ? "partial" : "done";
  else if (done > 0) state = "partial";
  else if (failed > 0) state = "failed";
  else state = "pending";
  return { key, label, node, state, done, total, detail };
}

/**
 * 六阶段状态机 + 进度。
 *
 * 对应现场问题：分镜生图没有任何门禁，资产/塑角没做也能点进去；
 * 全自动模式跑完骨架/剧本就静静停下，没有「骨架✓ 剧本✓ 资产✓ 分镜图 16/35 视频 0/14」这样的看板。
 * 这里把每一步的产物计数和「卡在哪、下一步该做什么」一次性算出来给前端。
 */
export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    scriptId: z.number().optional(),
  }),
  async (req, res) => {
    try {
      const { projectId, scriptId: rawScriptId } = req.body;

      const scriptRows = await u.db("o_script").where("projectId", projectId).select("id", "name", "content");
      const scriptId = rawScriptId ?? scriptRows[0]?.id;
      const scriptDone = scriptRows.filter((s: any) => String(s.content ?? "").trim().length > 0).length;
      const scriptStage = stage(
        "script",
        "剧本",
        "script",
        scriptDone,
        scriptRows.length,
        scriptRows.length ? `${scriptDone}/${scriptRows.length} 集有正文` : "还没有创建剧集",
      );

      // ---- 资产 ----
      const assetRows = await u
        .db("o_assets")
        .where("projectId", projectId)
        .where("assetsId", null)
        .whereIn("type", ["role", "scene", "tool"])
        .select("id", "name", "type", "prompt", "promptState", "promptErrorReason", "imageId");
      const assetTotal = assetRows.length;
      const assetPromptFailed = assetRows.filter((a: any) => a.promptState === "生成失败" || a.promptState === "失败").length;
      const assetPromptDone = assetRows.filter((a: any) => a.prompt && a.promptState === "已完成").length;

      const assetsStage = stage(
        "assets",
        "提取资产",
        "assets",
        assetTotal,
        assetTotal,
        assetTotal
          ? `角色/场景/道具共 ${assetTotal} 个，提示词 ${assetPromptDone}/${assetTotal}${assetPromptFailed ? `，失败 ${assetPromptFailed}` : ""}`
          : "还没有从剧本里提取资产",
        assetPromptFailed,
      );

      // 资产是否真的出图：看 o_assets.imageId 指向的 o_image 有没有落盘文件
      const assetImageIds = assetRows.map((a: any) => a.imageId).filter((id: any): id is number => typeof id === "number");
      let assetImageDone = 0;
      if (assetImageIds.length) {
        const images = await u.db("o_image").whereIn("id", assetImageIds).select("id", "filePath", "state");
        assetImageDone = images.filter((i: any) => i.filePath && i.state !== "生成失败").length;
      }
      const assetImageFailed = assetTotal - assetImageDone;
      const assetImageStage = stage(
        "assetImage",
        "资产出图",
        "assets",
        assetImageDone,
        assetTotal,
        assetTotal ? `${assetImageDone}/${assetTotal} 个资产已有参考图${assetImageFailed > 0 ? `，${assetImageFailed} 个待出图` : ""}` : "等待资产提取",
        assetImageFailed > 0 ? 1 : 0,
      );

      // ---- 分镜 ----
      const storyboards = scriptId
        ? await u.db("o_storyboard").where("projectId", projectId).where("scriptId", scriptId).select("id", "state", "reason", "shouldGenerateImage", "prompt")
        : [];
      const storyboardTotal = storyboards.length;
      const needImage = storyboards.filter((s: any) => s.shouldGenerateImage === 1);
      const storyboardImageDone = needImage.filter((s: any) => s.state === "已完成").length;
      const storyboardImageFailed = needImage.filter((s: any) => s.state === "生成失败").length;
      const storyboardGenerating = needImage.filter((s: any) => s.state === "生成中").length;
      const storyboardNoPrompt = storyboards.filter((s: any) => !String(s.prompt ?? "").trim()).length;

      const storyboardStage = stage(
        "storyboard",
        "分镜",
        "storyboardTable",
        storyboardTotal,
        storyboardTotal,
        storyboardTotal ? `${storyboardTotal} 条分镜${storyboardNoPrompt ? `，其中 ${storyboardNoPrompt} 条提示词为空` : ""}` : "还没有生成分镜",
        storyboardNoPrompt > 0 ? storyboardNoPrompt : 0,
      );

      const storyboardImageStage = stage(
        "storyboardImage",
        "分镜图",
        "storyboard",
        storyboardImageDone,
        needImage.length,
        needImage.length
          ? `${storyboardImageDone}/${needImage.length}${storyboardGenerating ? `，生成中 ${storyboardGenerating}` : ""}${storyboardImageFailed ? `，失败 ${storyboardImageFailed}` : ""}`
          : "等待分镜",
        storyboardImageFailed,
      );

      // ---- 视频 ----
      const videos = scriptId
        ? await u.db("o_video").where("projectId", projectId).where("scriptId", scriptId).select("id", "state", "errorReason")
        : [];
      const videoDone = videos.filter((v: any) => v.state === "已完成" || v.state === "生成成功").length;
      const videoFailed = videos.filter((v: any) => v.state === "生成失败").length;
      const videoStage = stage(
        "video",
        "视频",
        "workbench",
        videoDone,
        storyboardTotal,
        storyboardTotal ? `${videoDone}/${storyboardTotal} 条分镜有视频${videoFailed ? `，失败 ${videoFailed}` : ""}` : "等待分镜",
        videoFailed,
      );

      const stages: Stage[] = [
        scriptStage,
        assetsStage,
        assetImageStage,
        storyboardStage,
        storyboardImageStage,
        videoStage,
      ];

      // ---- 失败原因归类：把库里的 reason 抬成「分类 + 计数」，前端不用再逐个点开 ----
      const reasonBuckets = new Map<ErrorType, number>();
      const allReasons = [
        ...storyboards.map((s: any) => s.reason),
        ...assetRows.map((a: any) => a.promptErrorReason),
      ].filter((r: any) => String(r ?? "").trim());
      for (const reason of allReasons) {
        const type = classifyError(reason).type;
        reasonBuckets.set(type, (reasonBuckets.get(type) ?? 0) + 1);
      }
      const reasonSummary = [...reasonBuckets.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => {
          const cls = classifyError(type === "safety" ? "敏感词" : type === "network" ? "fetch failed" : "生成失败");
          return { type, count, label: cls.label };
        });

      // ---- 门禁 ----
      const blockers: Blocker[] = [];
      if (scriptRows.length === 0) {
        blockers.push({
          code: "NO_SCRIPT",
          message: "请先在剧本管理中创建剧集",
          stage: "script",
          node: "script",
          actionLabel: "去创建剧集",
        });
      }
      if (scriptRows.length > 0 && assetTotal === 0) {
        blockers.push({
          code: "NO_ASSETS",
          message: "还没有提取资产，分镜提示词里的 @图 引用会是悬空的",
          stage: "assets",
          node: "assets",
          actionLabel: "去提取资产",
        });
      }
      if (assetTotal > 0 && assetImageDone < assetTotal) {
        blockers.push({
          code: "ASSET_IMAGE_MISSING",
          message: `有 ${assetTotal - assetImageDone} 个资产还没有参考图，生成分镜图时这些 @图 引用会缺失`,
          stage: "assetImage",
          node: "assets",
          actionLabel: "去给资产出图",
        });
      }
      if (assetPromptFailed > 0) {
        blockers.push({
          code: "ASSET_PROMPT_FAILED",
          message: `${assetPromptFailed} 个资产的提示词生成失败`,
          stage: "assets",
          node: "assets",
          actionLabel: "去看失败原因",
        });
      }
      if (assetTotal > 0 && storyboardTotal === 0) {
        blockers.push({
          code: "NO_STORYBOARD",
          message: "还没有分镜，之后所有画面都无从生成",
          stage: "storyboard",
          node: "storyboardTable",
          actionLabel: "去生成分镜",
        });
      }
      if (storyboardTotal > 0 && storyboardImageDone === 0) {
        blockers.push({
          code: "NO_STORYBOARD_IMAGE",
          message: "还没有可用的分镜图，视频生成缺少首尾帧素材",
          stage: "storyboardImage",
          node: "storyboard",
          actionLabel: "去生成分镜图",
        });
      }

      // ---- 下一步 ----
      const firstUnfinished = stages.find((s) => s.state !== "done");
      const nextStep = firstUnfinished
        ? {
            stage: firstUnfinished.key,
            label: firstUnfinished.label,
            node: firstUnfinished.node,
            detail: firstUnfinished.detail,
          }
        : null;

      res.status(200).send(
        success({
          projectId,
          scriptId: scriptId ?? null,
          stages,
          blockers,
          reasonSummary,
          nextStep,
          /** 供给全自动模式：当前该自动跑哪一步 */
          autoAction: firstUnfinished ? `auto:${firstUnfinished.key}` : "auto:done",
        }),
      );
    } catch (err) {
      res.status(500).send({ message: String(err) });
    }
  },
);
