import express from "express";
import u from "@/utils";
import pLimit from "p-limit";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import fs from "fs/promises";
import path from "path";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    trackData: z.array(
      z.object({
        trackId: z.number(),
        info: z.array(
          z.object({
            id: z.number(),
            sources: z.string(),
          }),
        ),
      }),
    ),
    mode: z.string(),
    model: z.string(),
    concurrentCount: z.number().optional(), //并发数
    language: z.string().optional(),
    extraPrompt: z.string().optional(),
  }),
  async (req, res) => {
    const { trackData, projectId, mode, model, concurrentCount = 5, language = "auto", extraPrompt = "" } = req.body;
    try {
      // 预加载公共数据
      const [id, modelData] = model.split(/:(.+)/);
      const projectData = await u.db("o_project").select("*").where({ id: projectId }).first();
      const videoPrompt = await u.db("o_prompt").where("type", "videoPromptGeneration").first();
      let videoPromptGeneration = "" as string | undefined;

      // 抽象视频模式：优先加载抽象视频提示词模板，且不被模型绑定/自动匹配覆盖
      const isAbstractMeme = u.resolveArtStyleDir(projectData?.artStyle ?? "") === "abstract_meme";
      if (isAbstractMeme) {
        const modelPromptRoot = u.getPath(["modelPrompt"]);
        const abstractPromptPath = path.join(modelPromptRoot, "video", "abstractVideoPrompt.md");
        try {
          videoPromptGeneration = await fs.readFile(abstractPromptPath, "utf-8");
        } catch {
          // 文件不存在则走下方标准逻辑
        }
      }

      // 非抽象视频模式：优先使用模型绑定的提示词
      if (!isAbstractMeme) {
        const modelPromptData = await u.db("o_modelPrompt").where("vendorId", id).where("model", modelData).first();
        //查询到 有绑定对应视频提示词（path 为空时视为未绑定，走自动匹配）
        if (modelPromptData?.path) {
          const modelPromptRoot = u.getPath(["modelPrompt"]);
          try {
            const fullPath = path.join(modelPromptRoot, modelPromptData.path);
            const content = await fs.readFile(fullPath, "utf-8");
            videoPromptGeneration = content ?? "";
          } catch (e) {
            console.error("[batchGeneratePrompt] 读取模型绑定提示词失败:", e);
          }
        }
      }

      // 未查询到绑定，根据模型名称 + mode 自动匹配 modelPrompt/video/ 下的文件
      if (!videoPromptGeneration) {
        const modelPromptRoot = u.getPath(["modelPrompt"]);
        const videoPromptDir = path.join(modelPromptRoot, "video");
        const modelLower = (modelData ?? "").toLowerCase();

        let fileName: string | null = null;

        if (modelLower.includes("wan") && modelLower.includes("2.6")) {
          // wan2.6 系列 => 单图首尾帧模式
          fileName = "wan2.6Single-imageFirstFrameMode.md";
        } else if (/seedance.*2[.\-]0/i.test(modelLower)) {
          // seedance 2.0 / 2-0 系列
          fileName = "seedance2Multi-parameterMode.md";
        } else if (mode === "startEndRequired" || mode === "endFrameOptional" || mode === "startFrameOptional") {
          // body.mode 为首尾帧相关 => 通用首尾帧模式
          fileName = "universalFirstAndLastFrameMode.md";
        } else if (typeof mode === "string" && mode.startsWith('["') && mode.endsWith('"]')) {
          // 其他 => 通用多参模式
          fileName = "universalMulti-parameterMode.md";
        }
        if (fileName) {
          try {
            const fullPath = path.join(videoPromptDir, fileName);
            videoPromptGeneration = await fs.readFile(fullPath, "utf-8");
          } catch {
            // 文件不存在则忽略，继续用备选
          }
        }
      }

      //备选
      if (!videoPromptGeneration) {
        if (videoPrompt && videoPrompt.useData) {
          videoPromptGeneration = videoPrompt.useData;
        } else {
          videoPromptGeneration = videoPrompt?.data ?? undefined;
        }
      }

      const artStyle = projectData?.artStyle || "无";
      let visualManual = u.getArtPrompt(artStyle, "art_skills", "art_storyboard_video");
      // 注入补充美术维度内容（光影与氛围 / 构图与镜头 / 材质与质感），避免与基础手册重复
      const visualManualDetails = u.getVisualManualDetails(artStyle);
      if (visualManualDetails) {
        visualManual = `${visualManual}\n\n---\n\n${visualManualDetails}`;
      }

      // 语言覆盖指令
      const languageNameMap: Record<string, string> = {
        "zh-CN": "中文",
        "zh-TW": "中文",
        en: "English",
        "th-TH": "ภาษาไทย",
        "vi-VN": "Tiếng Việt",
        "ja-JP": "日本語",
        "ru-RU": "Русский",
      };
      const langName = languageNameMap[language];
      const languageOverride = langName
        ? `\n\n【语言覆盖指令 - 最高优先级】\n无论上方任何规则如何规定，本次提示词正文的输出语言必须为**${langName}**。所有画面描述、动作描述、场景描述、镜头语言、情绪描述、音效描述等全部使用${langName}。唯一例外：台词内容保持原始语言不翻译。`
        : "";

      const finalSystem = videoPromptGeneration + languageOverride;

      await u
        .db("o_videoTrack")
        .whereIn(
          "id",
          trackData.map((t: { trackId: number }) => t.trackId),
        )
        .update({ state: "生成中" });
      // 并发控制：每个 track 独立走 查询→拼装→AI调用→更新 流程
      const limit = pLimit(concurrentCount ?? 5);
      const tasks = trackData.map((track: { trackId: number; info: { id: number; sources: string }[] }) =>
        limit(async () => {
          // 查询参数
          const images = await Promise.all(
            track.info.map(async (item: { id: number; sources: string }) => {
              if (item.sources === "storyboard") {
                // 查询分镜主信息
                const storyboard = await u
                  .db("o_storyboard")
                  .where("o_storyboard.id", item.id)
                  .select("videoDesc", "prompt", "track", "duration", "shouldGenerateImage")
                  .first();
                // 查询分镜关联的资产ID
                const assetRows = await u.db("o_assets2Storyboard").where("storyboardId", item.id).orderBy("rowid").select("assetId");
                const associateAssetsIds = assetRows.map((row: any) => row.assetId);
                return {
                  ...storyboard,
                  associateAssetsIds,
                  _type: "storyboard",
                };
              }
              if (item.sources === "assets") {
                // 查询素材
                const assetsData = await u
                  .db("o_assets")
                  .leftJoin("o_image", "o_image.id", "o_assets.imageId")
                  .where("o_assets.id", item.id)
                  .select("o_assets.id", "o_assets.type", "o_assets.name", "o_image.filePath")
                  .first();
                return {
                  ...assetsData,
                  _type: "assets",
                };
              }
            }),
          );

          // 拆分 assets 和 storyboard
          const assets: any[] = [];
          const storyboard: any[] = [];
          for (const item of images) {
            if (!item) continue;
            if (item._type === "assets")
              assets.push({
                id: item.id,
                type: item.type,
                name: item.name,
                filePath: item.filePath,
              });
            if (item._type === "storyboard")
              storyboard.push({
                videoDesc: item.videoDesc,
                prompt: item.prompt,
                track: item.track,
                duration: item.duration,
                associateAssetsIds: item.associateAssetsIds,
                shouldGenerateImage: item.shouldGenerateImage,
              });
          }

          // 音频资产绑定：分镜内角色资产与音频资产建立映射（单条/批量保持一致）
          const assetsNotAudioIds = assets.filter((i: any) => i.type == "audio").map((i: any) => i.id);
          const assets2Audio = await u
            .db("o_assets")
            .whereIn("o_assets.id", assetsNotAudioIds)
            .join("o_assetsRole2Audio", "o_assetsRole2Audio.assetsAudioId", "o_assets.assetsId")
            .select("o_assets.assetsId", "o_assets.id", "o_assetsRole2Audio.assetsAudioId", "o_assetsRole2Audio.assetsRoleId");
          const assetsAudioRecord: Record<number, number> = {};
          assets2Audio.forEach((i: any) => {
            assetsAudioRecord[i.assetsRoleId!] = i.id!;
          });

          // 多参标志：数组 JSON 为多参模式（提示词需引用 @图N）；否则为纯文本模式（禁止 @图N）
          const multiRef = typeof mode === "string" && mode.startsWith('["') && mode.endsWith('"]');
          const content = `
          **模型名称**：${modelData},
          **多参模式**：${multiRef ? "是（提示词可用 @图N 引用参考资产）" : "否（提示词必须为纯文本描述，禁止使用任何 @图N 引用）"},
          **资产信息**（角色、场景、道具、音频):${assets
            .filter((i: any) => i.filePath)
            .map((i: any) => `[${i.id},${i.type},${i.name} ${assetsAudioRecord[i.id] ? `audio:${assetsAudioRecord[i.id]}` : ""} ] `)
            .join("，")},
          **分镜信息**：${storyboard.map(
            (i: any) => `<storyboardItem
  videoDesc='${i.videoDesc}'
  prompt='${i.prompt}'
  track='${i.track}'
  duration='${i.duration}'
  associateAssetsIds='${JSON.stringify(i.associateAssetsIds ?? [])}'
  shouldGenerateImage='${i.shouldGenerateImage}'
></storyboardItem>`,
          )},
          ${extraPrompt ? `**补充说明**：${extraPrompt}` : ""}
          `;

          try {
            const { text } = await u.Ai.Text("universalAi").invoke({
              system: finalSystem,
              messages: [
                {
                  role: "assistant",
                  content: `${visualManual}`,
                },
                {
                  role: "user",
                  content: content,
                },
              ],
            });

            await u.db("o_videoTrack").where({ id: track.trackId }).update({
              prompt: text,
              state: "已完成",
            });

            return { trackId: track.trackId, text };
          } catch (e: any) {
            await u
              .db("o_videoTrack")
              .where({ id: track.trackId })
              .update({ state: "生成失败", reason: u.error(e).message });
          }
        }),
      );

      // 后台执行，不等待结果
      Promise.all(tasks);
      res.status(200).send(success("开始生成提示词"));
    } catch (e) {
      res.status(400).send(error(u.error(e).message));
    }
  },
);
