import express from "express";
import u from "@/utils";
import { z } from "zod";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    id: z.number(),
    videoDesc: z.string().optional(),
    prompt: z.string().nullable().optional(),
    duration: z.number().optional(),
    track: z.string().optional(),
    shouldGenerateImage: z.number().optional(),
    associateAssetsIds: z.array(z.number()).optional(),
  }),
  async (req, res) => {
    const { id, videoDesc, prompt, duration, track, shouldGenerateImage, associateAssetsIds } = req.body;

    const storyboardData = await u.db("o_storyboard").where("id", id).first();
    if (!storyboardData) return res.status(400).send(error("未找到该分镜"));

    const { scriptId, projectId } = storyboardData;

    // 构造更新对象（仅包含传入的字段）
    const updateData: Record<string, any> = {};
    if (videoDesc !== undefined) updateData.videoDesc = videoDesc;
    if (prompt !== undefined) updateData.prompt = prompt ?? "";
    if (duration !== undefined) updateData.duration = String(duration);
    if (track !== undefined) updateData.track = track;
    if (shouldGenerateImage !== undefined) updateData.shouldGenerateImage = shouldGenerateImage;

    if (Object.keys(updateData).length > 0) {
      await u.db("o_storyboard").where("id", id).update(updateData);
    }

    // 更新关联资产
    if (associateAssetsIds !== undefined) {
      await u.db("o_assets2Storyboard").where("storyboardId", id).delete();
      if (associateAssetsIds.length > 0) {
        await u.db("o_assets2Storyboard").insert(
          associateAssetsIds.map((assetId: number) => ({ assetId, storyboardId: id })),
        );
      }
    }

    // 处理 track 变更或 duration 变更时的 videoTrack 重算
    const trackChanged = track !== undefined && track !== storyboardData.track;
    const durationChanged = duration !== undefined && Number(storyboardData.duration) !== duration;

    if (trackChanged) {
      // 旧 track：检查是否还有其他分镜，没有则删除 videoTrack，有则重算 duration
      const oldTrackStoryboards = await u.db("o_storyboard").where({ scriptId, track: storyboardData.track }).whereNot("id", id).select("id", "duration");
      if (oldTrackStoryboards.length === 0) {
        if (storyboardData.trackId) await u.db("o_videoTrack").where("id", storyboardData.trackId).delete();
      } else {
        const oldTrackDuration = oldTrackStoryboards.reduce((sum: number, item: any) => sum + Number(item.duration), 0);
        await u.db("o_videoTrack").where("id", storyboardData.trackId).update({ duration: oldTrackDuration });
      }

      // 新 track：查找是否已有 trackId，有则复用，没有则新建
      const newTrackExisting = await u.db("o_storyboard").where({ scriptId, track }).whereNotNull("trackId").whereNot("id", id).first();
      let newTrackId: number;
      if (newTrackExisting?.trackId) {
        newTrackId = newTrackExisting.trackId;
      } else {
        const [createdId] = await u.db("o_videoTrack").insert({ scriptId, projectId, duration: 0 });
        newTrackId = createdId;
      }
      await u.db("o_storyboard").where("id", id).update({ trackId: newTrackId });

      // 重算新 track 的 duration
      const newTrackStoryboards = await u.db("o_storyboard").where({ scriptId, track }).select("duration");
      const newTrackDuration = newTrackStoryboards.reduce((sum: number, item: any) => sum + Number(item.duration), 0);
      await u.db("o_videoTrack").where("id", newTrackId).update({ duration: newTrackDuration });
    } else if (durationChanged) {
      // track 未变但 duration 变了，重算当前 track 的 videoTrack duration
      const currentTrack = track !== undefined ? track : storyboardData.track;
      const trackStoryboards = await u.db("o_storyboard").where({ scriptId, track: currentTrack }).select("duration");
      const trackDuration = trackStoryboards.reduce((sum: number, item: any) => sum + Number(item.duration), 0);
      const currentTrackId = storyboardData.trackId;
      if (currentTrackId) await u.db("o_videoTrack").where("id", currentTrackId).update({ duration: trackDuration });
    }

    // 返回更新后的分镜数据
    const updated = await u.db("o_storyboard").where("id", id).first();
    if (!updated) return res.status(400).send(error("未找到该分镜"));

    const resultAssociateAssetsIds = await u
      .db("o_assets2Storyboard")
      .where("storyboardId", id)
      .orderBy("rowid")
      .select("assetId")
      .pluck("assetId");

    const storyboardResult = {
      id: updated.id,
      trackId: updated.trackId,
      prompt: updated.prompt,
      duration: Number(updated.duration),
      state: updated.state,
      scriptId: updated.scriptId,
      reason: updated.reason,
      videoDesc: updated.videoDesc,
      shouldGenerateImage: updated.shouldGenerateImage,
      src: updated.filePath ? await u.oss.getSmallImageUrl(updated.filePath) : "",
      associateAssetsIds: resultAssociateAssetsIds,
    };

    res.status(200).send(success(storyboardResult));
  },
);
