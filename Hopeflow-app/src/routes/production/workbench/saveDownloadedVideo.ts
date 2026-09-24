import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";

const router = express.Router();

/**
 * 浏览器下载结果文件后回传 base64 保存为视频文件。
 * 仅允许将"待下载"状态的视频记录落盘，避免覆盖已有文件。
 */
export default router.post(
  "/",
  validateFields({
    videoId: z.number(),
    base64: z.string(),
  }),
  async (req, res) => {
    const { videoId, base64 } = req.body;
    const videoData = await u.db("o_video").where("id", videoId).first();
    if (!videoData) return res.status(400).send(error("视频记录不存在"));
    if (videoData.state !== "待下载" || !videoData.filePath) {
      return res.status(400).send(error("视频状态不是待下载，无法保存"));
    }
    try {
      await u.oss.writeFile(videoData.filePath, base64);
      await u.db("o_video").where("id", videoId).update({ state: "已完成", errorReason: "" });
      const path = await u.oss.getFileUrl(videoData.filePath);
      return res.status(200).send(success({ path, videoId }));
    } catch (e) {
      return res.status(400).send(error(u.error(e).message || "保存视频失败"));
    }
  },
);
