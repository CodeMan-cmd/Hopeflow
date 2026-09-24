import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    id: z.number(),
  }),
  async (req, res) => {
    const { id } = req.body;
    // 级联删除该轨道下生成的视频（含文件），避免孤儿数据
    const videos = await u.db("o_video").where("videoTrackId", id).select("id", "filePath");
    await Promise.all(
      videos.map(async (v) => {
        try {
          v.filePath && (await u.oss.deleteFile(v.filePath));
        } catch (e) {}
        await u.db("o_video").where("id", v.id).delete();
      }),
    );
    await u.db("o_videoTrack").where("id", id).delete();
    await u.db("o_storyboard").where("trackId", id).update({
      trackId: null,
    });
    res.status(200).send(success({ message: "视频段删除成功" }));
  },
);
