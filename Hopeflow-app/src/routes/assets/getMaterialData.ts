import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

// 获取生成图片
export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    scriptId: z.number().optional(),
  }),
  async (req, res) => {
    const { projectId, scriptId } = req.body;
    const list = await u
      .db("o_assets")
      .leftJoin("o_image", "o_assets.id", "=", "o_image.assetsId")
      .where("o_assets.type", "clip")
      .andWhere("o_assets.projectId", projectId)
      .select("*");
    const data = await Promise.all(
      list.map(async (item) => ({
        ...item,
        filePath: item.filePath ? await u.oss.getFileUrl(item.filePath) : "",
      })),
    );
    //拿到本地片尾视频并插入到data中
    const ending = await u.oss.getFileUrl("/ending.mp4", "assets");
    data.push({
      id: 0,
      name: "Hopeflow片尾",
      filePath: ending,
      type: "clip",
    });
    // 查询视频轨道
    const trackRows = await u
      .db("o_videoTrack")
      .where("o_videoTrack.scriptId", scriptId)
      .andWhere("o_videoTrack.projectId", projectId)
      .select("o_videoTrack.id as trackId", "o_videoTrack.videoId");
    const trackIds = trackRows.map((t) => t.trackId).filter((id): id is number => id != null);
    // 一次查询所有已完成的轨道视频，按 videoTrackId 分组，避免 N+1
    const trackVideos = await u.db("o_video").whereIn("videoTrackId", trackIds).andWhere("state", "已完成").select("*");
    const videoMap = new Map<number, typeof trackVideos[number][]>();
    trackVideos.forEach((v) => {
      const list = videoMap.get(v.videoTrackId!) ?? [];
      list.push(v);
      videoMap.set(v.videoTrackId!, list);
    });
    // 按轨道分组处理视频
    const video = await Promise.all(
      trackRows.map(async (track) => ({
        id: track.trackId,
        videoId: track.videoId,
        video: await Promise.all(
          (videoMap.get(track.trackId) ?? []).map(async (v) => ({
            id: v.id,
            filePath: v.filePath ? await u.oss.getFileUrl(v.filePath) : "",
            videoTrackId: v.videoTrackId,
          })),
        ),
      })),
    ).then((tracks) => tracks.filter((track) => track.video.length > 0));

    res.status(200).send(success({ data, video }));
  },
);
