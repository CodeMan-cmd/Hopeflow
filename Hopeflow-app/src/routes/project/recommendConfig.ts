import express from "express";
import u from "@/utils";
import { success } from "@/lib/responseFormat";
import {
  getImageQualityConstraint,
  listArtStyleOptions,
  listDirectorManualOptions,
  modeToKey,
  resolveArtStyleValue,
  validateProjectConfig,
} from "@/utils/projectConfig";
const router = express.Router();

// 从启用供应商中选出第一个可用模型，返回 modelId（id:modelName）与显示名
async function pickFirstModel(type: "image" | "video") {
  const dataList = await u.db("o_vendorConfig").select("id").where("enable", 1);
  if (!dataList || dataList.length === 0) return { modelId: "", label: "" };
  const modelList = await Promise.all(dataList.map((i) => u.vendor.getModelList(i.id!)));
  for (let i = 0; i < dataList.length; i++) {
    const target = modelList[i].find((m: any) => m.type === type);
    if (target) {
      return { modelId: `${dataList[i].id}:${target.modelName}`, label: target.name || target.modelName };
    }
  }
  return { modelId: "", label: "" };
}

// 取视频模型第一个可用 mode，数组转 JSON 字符串（与前端 modeToKey 一致）
function pickFirstMode(modes: unknown): string {
  if (!Array.isArray(modes) || modes.length === 0) return "text";
  const first = modes[0];
  return Array.isArray(first) ? JSON.stringify(first) : String(first);
}

// 按画风名称模糊匹配视觉手册：目录名或 README 首行标题任一命中即可。
// 匹配不到时返回空串，调用方必须如实告知前端「没解析到」，不能当成成功。
function matchArtStyle(artStyle?: string): string {
  return resolveArtStyleValue(artStyle);
}

// 按画风目录名匹配导演手册目录名（story_skills 下的目录），未命中取第一个
function matchDirectorManual(stylePath?: string): string {
  const enabledDirs = listDirectorManualOptions().map((o) => o.value);
  if (!enabledDirs.length) return "";
  if (stylePath) {
    const kw = String(stylePath).toLowerCase();
    const hit = enabledDirs.find((d) => d.toLowerCase().includes(kw));
    if (hit) return hit;
  }
  return enabledDirs[0];
}

/**
 * AI 创建项目智能推荐：图片/视频模型、画质、模式、画风路径、导演手册。
 *
 * 与之前实现的关键差别：
 * 1. 画质不再硬编码 "2K"。2K 是现场 30 条「模型未部署或不支持该接口」的真实原因，
 *    改为按模型能力取支持的最高档，拿不到能力声明时退回 1K。
 * 2. mode 与视频模型联动，返回的 mode 一定是该模型声明支持的。
 * 3. 画风/导演手册解析不到时如实返回 artStyleResolved=false + 候选，
 *    前端据此强制用户从内置手册里选一个，而不是把 AI 自由发挥的值直接存进库。
 */
export default router.post("/", async (req, res) => {
  try {
    const { artStyle, videoModel } = req.body || {};
    const image = await pickFirstModel("image");
    let video = { modelId: "", label: "" };
    let mode = "text";
    // 用户已选视频模型时沿用其 mode，否则取第一个可用的视频模型
    if (videoModel) {
      const [id, name] = String(videoModel).split(/:(.+)/);
      const models = await u.vendor.getModelList(id);
      const target = models.find((m: any) => m.modelName === name);
      if (target) {
        video = { modelId: String(videoModel), label: target.name || name };
        mode = pickFirstMode(target.mode);
      }
    }
    if (!video.modelId) {
      const picked = await pickFirstModel("video");
      video = picked;
      if (picked.modelId) {
        const [id, name] = picked.modelId.split(/:(.+)/);
        const models = await u.vendor.getModelList(id);
        const target = models.find((m: any) => m.modelName === name);
        if (target) mode = pickFirstMode(target.mode);
      }
    }

    const stylePath = matchArtStyle(artStyle);
    const directorManual = matchDirectorManual(stylePath || artStyle);

    // 画质：按模型能力取最高可用档，避免踩 2K 陷阱
    const qualityConstraint = await getImageQualityConstraint(image.modelId);
    const preferredOrder = ["4K", "2K", "1K"];
    const imageQuality = qualityConstraint.qualities
      ? (preferredOrder.find((q) => qualityConstraint.qualities!.includes(q)) ?? qualityConstraint.qualities[0])
      : "1K";

    // 用同一套落地校验复核推荐结果，把问题如实回传，而不是让用户到生成时才发现
    const validation = await validateProjectConfig(
      {
        artStyle: stylePath,
        directorManual,
        imageModel: image.modelId,
        videoModel: video.modelId,
        imageQuality,
        mode,
      },
      false,
    );

    res.status(200).send(
      success({
        imageModel: image.modelId,
        imageModelLabel: image.label,
        videoModel: video.modelId,
        videoModelLabel: video.label,
        imageQuality,
        mode,
        artStyle: stylePath,
        // 画风是否真的解析到内置手册目录——前端据此决定能否直接进确认页
        artStyleResolved: !!stylePath,
        artStyleInput: artStyle ?? "",
        artStyleCandidates: stylePath ? [] : listArtStyleOptions().slice(0, 8),
        directorManual,
        directorManualResolved: !!directorManual,
        modeCandidates: mode ? [modeToKey(mode)] : [],
        imageQualitySource: qualityConstraint.source,
        issues: validation.issues,
        warnings: validation.warnings,
      }),
    );
  } catch (err) {
    res.status(500).send({ error: String(err) });
  }
});
