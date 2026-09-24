import express from "express";
import u from "@/utils";
import { z } from "zod";
import sharp from "sharp";
import pLimit from "p-limit";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { Output, tool } from "ai";
import { assetItemSchema } from "@/agents/productionAgent/tools";
import { classifyError } from "@/utils/errorClassify";
import { artStyleExists } from "@/utils/projectConfig";
const router = express.Router();
export type AssetData = z.infer<typeof assetItemSchema>;

// 参考图读取并发上限，避免瞬时打满文件 IO / sharp 线程池
const imageReadLimit = pLimit(4);

export default router.post(
  "/",
  validateFields({
    storyboardIds: z.array(z.number()),
    projectId: z.number(),
    scriptId: z.number(),
    concurrentCount: z.number().min(1).optional(),
    compulsory: z.boolean().optional(),
    model: z.string().optional(),
    /** 只补失败项：跳过已完成的分镜，避免「重跑」把好的也全量重做 */
    onlyFailed: z.boolean().optional(),
    /** 用户已确认「资产没出图也要继续生成分镜图」 */
    acknowledgeMissingAssets: z.boolean().optional(),
  }),
  async (req, res) => {
    const {
      storyboardIds,
      projectId,
      scriptId,
      concurrentCount = 5,
      compulsory = false,
      model,
      onlyFailed = false,
      acknowledgeMissingAssets = false,
    }: {
      storyboardIds: number[];
      projectId: number;
      scriptId: number;
      concurrentCount: number;
      compulsory: boolean;
      model?: string;
      onlyFailed?: boolean;
      acknowledgeMissingAssets?: boolean;
    } = req.body;
    if (!storyboardIds || storyboardIds.length === 0) return res.status(400).send(error("storyboardIds不能为空"));
    // 当没有 storyboardIds 时，通过 AI 生成新的分镜面板数据
    let finalStoryboardIds: number[] = storyboardIds || [];

    // 「只补失败项」必须在改状态之前先定下名单：
    // 下面统一会把状态刷成「生成中」，刷完再按 state==='生成失败' 过滤只会得到空集。
    if (onlyFailed) {
      const failedRows = await u
        .db("o_storyboard")
        .whereIn("id", finalStoryboardIds)
        .where("scriptId", scriptId)
        .where("state", "生成失败")
        .select("id");
      finalStoryboardIds = failedRows.map((r: any) => r.id);
      if (!finalStoryboardIds.length) {
        return res.status(200).send(success({ skipped: true, message: "没有需要补跑的分镜（当前没有生成失败项）", generated: [] }));
      }
    }

    const storyIds = finalStoryboardIds;
    // 先更新分镜状态，再统一查询一次（校验 + 响应 + 生成共用，避免重复查询且 state 为最新值）
    if (compulsory) {
      await u.db("o_storyboard").whereIn("id", storyIds).where("scriptId", scriptId).update({ state: "生成中", shouldGenerateImage: 1 });
    } else {
      await u.db("o_storyboard").whereIn("id", storyIds).where("scriptId", scriptId).where("shouldGenerateImage", 0).update({ state: "未生成" });
      await u.db("o_storyboard").whereIn("id", storyIds).where("scriptId", scriptId).where("shouldGenerateImage", 1).update({ state: "生成中" });
    }
    // shouldGenerateImage === 0 的分镜标记为「未生成」，其余标记为「生成中」
    const storyboardData = await u.db("o_storyboard").where("scriptId", scriptId).where("projectId", projectId).whereIn("id", storyIds);
    if (!storyboardData.length) return res.status(500).send(error("未查到分镜数据"));

    const projectSettingData = await u.db("o_project").where("id", projectId).select("imageModel", "imageQuality", "artStyle", "videoRatio").first();
    // 优先使用前端传入的模型，未传时回退到项目已配置的图像模型
    const imageModel = (model || projectSettingData?.imageModel) as `${string}:${string}`;
    if (!imageModel) return res.status(400).send(error("未选择图像模型"));

    // ---- 流程门禁 ----
    // 现场问题：没做「提取资产 / 塑角造景」也能直接点进分镜生图，平台没有任何阻拦，
    // 而分镜提示词里的 `@图1 为林奕{角色}` 在资产没图时是悬空的。
    // 这里把「上一步产物缺失」显式挡在生成之前。
    if (!artStyleExists(projectSettingData?.artStyle ?? undefined)) {
      return res.status(400).send({
        message: `项目画风「${projectSettingData?.artStyle ?? ""}」没有解析到内置视觉手册，分镜提示词会与实际画面风格脱节。请先到项目配置里重新选择画风。`,
        errorType: "config",
        code: "ART_STYLE_UNRESOLVED",
      });
    }

    // 按 rowid 顺序查出每个 storyboard 关联的 assetId 有序列表
    const assets2StoryboardRows = await u
      .db("o_assets2Storyboard")
      .whereIn("storyboardId", storyIds)
      .orderBy("rowid")
      .select("storyboardId", "assetId");

    // 收集所有 assetId，批量查对应的 imageId
    const allAssetIds = [...new Set(assets2StoryboardRows.map((r: any) => r.assetId))];
    const assetImageMap: Record<number, number> = {};
    if (allAssetIds.length > 0) {
      const assetRows = await u.db("o_assets").whereIn("id", allAssetIds).select("id", "imageId");
      assetRows.forEach((row: any) => {
        assetImageMap[row.id] = row.imageId;
      });
    }

    // 按 rowid 顺序重建 assetRecord，值为有序的 imageId 列表
    const assetRecord: Record<number, number[]> = {};
    assets2StoryboardRows.forEach((item: any) => {
      if (!assetRecord[item.storyboardId]) {
        assetRecord[item.storyboardId] = [];
      }
      const imageId = assetImageMap[item.assetId];
      if (imageId != null) {
        assetRecord[item.storyboardId].push(imageId);
      }
    });

    // 资产没出图时提示一次：分镜提示词里的 @图N 引用会缺失，
    // 但允许用户在知情后继续（acknowledgeMissingAssets），不硬堵死创作流程。
    const referencedAssetIds = [...new Set(assets2StoryboardRows.map((r: any) => r.assetId))];
    const assetsWithoutImage = referencedAssetIds.filter((id) => assetImageMap[id as number] == null);
    if (assetsWithoutImage.length > 0 && !acknowledgeMissingAssets) {
      const names = await u.db("o_assets").whereIn("id", assetsWithoutImage).select("name");
      return res.status(409).send({
        message: `有 ${assetsWithoutImage.length} 个被引用的资产还没有参考图，分镜图里的角色/场景会和资产设定对不上`,
        errorType: "prerequisite",
        code: "ASSET_IMAGE_MISSING",
        missingAssets: names.map((n: any) => n.name),
        actions: ["goToAssets", "continue"],
      });
    }

    res.status(200).send(
      success(
        storyboardData.map((i) => ({
          id: i.id,
          prompt: i.prompt,
          associateAssetsIds: assetRecord[i.id!],
          src: null,
          state: i.state,
          videoDesc: i.videoDesc,
          shouldGenerateImage: i.shouldGenerateImage,
          // 把失败原因一起回传：之前响应里没有 reason，导致面板上只能看到「生成失败」四个字
          reason: i.reason ?? "",
          errorType: i.errorType ?? "",
        })),
      ),
    );

    const generateTask = async (item: (typeof storyboardData)[number]) => {
      const repeloadObj = {
        prompt: item.prompt!,
        size: projectSettingData?.imageQuality as "1K" | "2K" | "4K",
        aspectRatio: projectSettingData?.videoRatio as `${number}:${number}`,
      };
      try {
        const imageCls = await u.Ai.Image(imageModel).run(
          {
            referenceList: await getAssetsImageBase64(assetRecord[item.id!] || []),
            ...repeloadObj,
          },
          {
            taskClass: "生成分镜图片",
            describe: "分镜图片生成",
            relatedObjects: JSON.stringify(repeloadObj),
            projectId: projectId,
          },
        );
        const savePath = `/${projectId}/assets/${scriptId}/${u.uuid()}.jpg`;
        await imageCls.save(savePath);
        await u.db("o_storyboard").where("id", item.id).update({
          filePath: savePath,
          state: "已完成",
          // 成功时清空旧错误，避免失败徽标/原因一直挂在这条分镜上
          reason: null,
          errorType: null,
        });
      } catch (e) {
        // 生成失败时保留该分镜之前成功生成的图片（如有），避免重新生成失败导致旧图丢失
        const reason = u.error(e).message;
        await u.db("o_storyboard")
          .where("id", item.id)
          .update({
            filePath: item.filePath ?? "",
            reason,
            state: "生成失败",
            errorType: classifyError(reason, {
              prompt: item.prompt ?? undefined,
              imageQuality: projectSettingData?.imageQuality ?? undefined,
              aspectRatio: (projectSettingData?.videoRatio as string) ?? undefined,
            }).type,
          });
      }
    };
    // 按 concurrentCount 控制并发数，分批执行；跳过 shouldGenerateImage === 0 的分镜
    let generateList = [];
    if (compulsory) {
      generateList = storyboardData;
    } else {
      generateList = storyboardData.filter((item) => item.shouldGenerateImage !== 0);
    }
    // 只补失败项时，storyIds 已经在改状态之前收敛为失败名单，
    // 这里的 storyboardData 也只会包含这批，不需要再按 state 过滤（状态已刷成「生成中」）
    for (let i = 0; i < generateList.length; i += concurrentCount) {
      const batch = generateList.slice(i, i + concurrentCount);
      await Promise.all(batch.map(generateTask));
    }
  },
);
async function getAssetsImageBase64(imageIds: number[]) {
  if (!imageIds.length) return [];

  const imagePaths = await u.db("o_image").whereIn("o_image.id", imageIds).select("o_image.id", "o_image.filePath");

  // 建立 id 到 filePath 的映射
  const id2Path = new Map<number, string>();
  for (const row of imagePaths) {
    id2Path.set(row.id, row.filePath);
  }

  // 保证输出顺序与 imageIds 一致
  const imageUrls = await Promise.all(
    imageIds.map((id) =>
      imageReadLimit(async () => {
        const filePath = id2Path.get(id);
        if (filePath) {
          try {
            return await u.oss.getImageBase64(filePath);
          } catch {
            return null;
          }
        }
        return null;
      }),
    ),
  );
  // 保留顺序，并且过滤掉无效项
  return (imageUrls.filter(Boolean) as string[]).map((url) => ({ type: "image" as const, base64: url }));
}
