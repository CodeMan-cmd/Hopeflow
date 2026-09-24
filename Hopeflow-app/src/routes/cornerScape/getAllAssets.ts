import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    type: z.array(z.string()).optional(),
  }),
  async (req, res) => {
    const { projectId, type } = req.body;
    const data = await u
      .db("o_assets")
      .leftJoin("o_image", "o_assets.imageId", "o_image.id")
      .select(
        "o_assets.*",
        "o_image.filePath",
        "o_image.state",
        "o_image.model",
        "o_image.resolution",
        "o_image.errorReason",
        "o_image.id as imageId",
      )
      .where("o_assets.projectId", projectId)
      .andWhere("o_assets.type", "<>", "clip")
      .andWhere("o_assets.type", "<>", "audio")
      .andWhere("o_assets.assetsId", null)
      .modify((qb) => {
        if (type && type.length > 0) qb.whereIn("o_assets.type", type);
      })
      .orderByRaw(`CASE o_assets.type WHEN 'role' THEN 1 WHEN 'scene' THEN 2 WHEN 'tool' THEN 3 ELSE 4 END`);
    const assets2AudioData = await u
      .db("o_assetsRole2Audio")
      .leftJoin("o_assets", "o_assets.id", "o_assetsRole2Audio.assetsAudioId")
      .whereIn(
        "o_assetsRole2Audio.assetsRoleId",
        data.map((i: any) => i.id!),
      )
      .select("o_assets.id", "o_assets.name", "o_assetsRole2Audio.assetsRoleId");
    // 批量取绑定音频的文件地址（父音频 → 子资产 imageId → o_image.filePath），供前端试听
    const audioParentIds = assets2AudioData.map((a: any) => a.id);
    const audioFileMap: Record<number, string> = {};
    if (audioParentIds.length) {
      const audioChildren = await u.db("o_assets").whereIn("assetsId", audioParentIds).select("id", "assetsId", "imageId");
      const childImageIds = audioChildren.map((c: any) => c.imageId).filter(Boolean);
      const audioImages = childImageIds.length
        ? await u.db("o_image").whereIn("id", childImageIds).select("id", "filePath")
        : [];
      const imagePathMap = new Map(audioImages.map((i: any) => [i.id, i.filePath]));
      audioChildren.forEach((c: any) => {
        const fp = imagePathMap.get(c.imageId);
        if (fp && !audioFileMap[c.assetsId]) audioFileMap[c.assetsId] = fp;
      });
    }
    const repleAssets: Record<number, { id: number; name: string; filePath: string }[]> = {};
    assets2AudioData.forEach((item: any) => {
      const withFile = { ...item, filePath: audioFileMap[item.id] ?? "" };
      if (!repleAssets[item.assetsRoleId]) repleAssets[item.assetsRoleId] = [withFile];
      else repleAssets[item.assetsRoleId].push(withFile);
    });
    // 批量查询全部历史图片（已完成），按 assetsId 分组，消除逐资产 N+1 查询
    const parentIds = data.map((i: any) => i.id!);
    const historyRows = await u
      .db("o_image")
      .whereIn("assetsId", parentIds)
      .andWhere("state", "已完成")
      .select("id", "assetsId", "filePath");
    const historyMap: Record<number, { id: number; assetsId: number; filePath: string | null }[]> = {};
    historyRows.forEach((img: any) => {
      if (!historyMap[img.assetsId]) historyMap[img.assetsId] = [];
      historyMap[img.assetsId].push(img);
    });
    const historyImagesWithUrl = (imgs: { id: number; filePath: string | null }[]) =>
      Promise.all(
        imgs.map(async (img: any) => ({
          id: img.id,
          filePath: img.filePath && (await u.oss.getSmallImageUrl(img.filePath)),
        })),
      );
    const result = await Promise.all(
      data.map(async (parent: any) => ({
        ...parent,
        filePath: parent.filePath && (await u.oss.getSmallImageUrl(parent.filePath!)),
        historyImages: await historyImagesWithUrl(historyMap[parent.id] ?? []),
        relepedAudio: repleAssets[parent.id] ?? [],
      })),
    );
    res.status(200).send(success(result));
  },
);
