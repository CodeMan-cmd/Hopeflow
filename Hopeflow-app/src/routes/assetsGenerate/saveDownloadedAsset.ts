import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";

const router = express.Router();

/**
 * 浏览器下载结果文件后回传 base64 保存为资产图片。
 * 仅允许将"待下载"状态的图片记录落盘，避免覆盖已有文件。
 */
export default router.post(
  "/",
  validateFields({
    imageId: z.number(),
    base64: z.string(),
  }),
  async (req, res) => {
    const { imageId, base64 } = req.body;
    const imageData = await u.db("o_image").where("id", imageId).first();
    if (!imageData) return res.status(400).send(error("图片记录不存在"));
    if (imageData.state !== "待下载" || !imageData.filePath) {
      return res.status(400).send(error("图片状态不是待下载，无法保存"));
    }
    try {
      await u.oss.writeFile(imageData.filePath, base64);
      await u.db("o_image").where("id", imageId).update({ state: "已完成", errorReason: "" });
      const path = await u.oss.getSmallImageUrl(imageData.filePath);
      return res.status(200).send(success({ path, imageId }));
    } catch (e) {
      return res.status(400).send(error(u.error(e).message || "保存图片失败"));
    }
  },
);
