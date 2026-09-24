import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    data: z.array(
      z.object({
        prompt: z.string(),
        duration: z.number(),
        track: z.string(),
        state: z.string(),
        src: z.string().nullable(),
        videoDesc: z.string(),
        shouldGenerateImage: z.number(),
        associateAssetsIds: z.array(z.number()),
      }),
    ),
    scriptId: z.number(),
    projectId: z.number(),
  }),
  async (req, res) => {
    const { data, scriptId, projectId } = req.body as {
      data: { prompt: string; duration: number; track: string; state: string; src: string | null; videoDesc: string; shouldGenerateImage: number; associateAssetsIds: number[] }[];
      scriptId: number;
      projectId: number;
    };
    if (!data.length) return res.status(400).send({ success: false, message: "数据不能为空" });

    // 批量插入分镜并关联资产
    for (const item of data) {
      const [id] = await u.db("o_storyboard").insert({
        prompt: item.prompt,
        duration: String(item.duration),
        state: item.state,
        scriptId,
        projectId,
        track: item.track,
        videoDesc: item.videoDesc,
        shouldGenerateImage: item.shouldGenerateImage,
        createTime: Date.now(),
      });
      if (item.associateAssetsIds?.length) {
        await u.db("o_assets2Storyboard").insert(
          item.associateAssetsIds.map((assetId: number) => ({ assetId, storyboardId: id })),
        );
      }
    }

    // 按本次插入涉及的 track 维护 videoTrack（duration = 组内分镜时长总和），不重算无关 track
    const involvedTracks = [...new Set(data.map((item) => item.track))];
    for (const track of involvedTracks) {
      const trackStoryboards = await u.db("o_storyboard").where({ scriptId, track }).select("id", "duration");
      if (!trackStoryboards.length) continue;
      const trackDuration = trackStoryboards.reduce((sum: number, item: any) => sum + Number(item.duration), 0);
      const existingStoryboard = await u.db("o_storyboard").where({ scriptId, track }).whereNotNull("trackId").first();
      let trackId: number;
      if (existingStoryboard?.trackId) {
        trackId = existingStoryboard.trackId;
        await u.db("o_videoTrack").where("id", trackId).update({ duration: trackDuration });
      } else {
        const [newTrackId] = await u.db("o_videoTrack").insert({ scriptId, projectId, duration: trackDuration });
        trackId = newTrackId;
      }
      await u.db("o_storyboard").whereIn("id", trackStoryboards.map((s: any) => s.id)).update({ trackId });
    }

    // 返回更新后的分镜数据（全量，供前端按 prompt/duration/videoDesc 回填 id 与 trackId）
    const storyboardData = await Promise.all(
      (await u.db("o_storyboard").where("scriptId", scriptId)).map(async (i: any) => ({
        associateAssetsIds: await u.db("o_assets2Storyboard").where("storyboardId", i.id).orderBy("rowid").select("assetId").pluck("assetId"),
        src: i.filePath ? await u.oss.getSmallImageUrl(i.filePath) : "",
        id: i.id,
        trackId: i.trackId,
        prompt: i.prompt,
        duration: Number(i.duration),
        state: i.state,
        scriptId: i.scriptId,
        reason: i.reason,
        videoDesc: i.videoDesc,
      })),
    );
    return res.status(200).send(success(storyboardData));
  },
);
