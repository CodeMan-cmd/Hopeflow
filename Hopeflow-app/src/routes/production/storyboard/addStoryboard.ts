import express from "express";
import u from "@/utils";
import { z } from "zod";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    prompt: z.string(),
    duration: z.number(),
    state: z.string(),
    videoDesc: z.string(),
    shouldGenerateImage: z.number(),
    src: z.string().nullable(),
    track: z.string().optional(),
    scriptId: z.number(),
    projectId: z.number(),
    flowId: z.number().optional(),
  }),
  async (req, res) => {
    const { prompt, duration, state, src, scriptId, projectId, videoDesc, shouldGenerateImage, track, flowId } = req.body;
    const trackName = track ?? "";

    // 指定了 track 时复用该 track 已有的 videoTrack（保持同组共享轨道），否则新建独立轨道
    let trackId = 0;
    if (trackName) {
      const existingTrack = await u.db("o_storyboard").where({ scriptId, track: trackName }).whereNotNull("trackId").first();
      trackId = existingTrack?.trackId ?? 0;
    }
    if (!trackId) {
      const [newId] = await u.db("o_videoTrack").insert({ scriptId, projectId });
      trackId = newId;
    }

    const [id] = await u.db("o_storyboard").insert({
      prompt,
      duration,
      state,
      filePath: u.replaceUrl(src),
      trackId,
      track: trackName || null,
      videoDesc,
      shouldGenerateImage: shouldGenerateImage ? 1 : 0,
      scriptId,
      projectId,
      flowId: flowId ?? null,
    });

    // 重算该 track 的总时长
    if (trackName) {
      const trackStoryboards = await u.db("o_storyboard").where({ scriptId, track: trackName }).select("duration");
      const trackDuration = trackStoryboards.reduce((sum: number, item: any) => sum + Number(item.duration), 0);
      await u.db("o_videoTrack").where("id", trackId).update({ duration: trackDuration });
    }

    return res.status(200).send(success({ id }));
  },
);
