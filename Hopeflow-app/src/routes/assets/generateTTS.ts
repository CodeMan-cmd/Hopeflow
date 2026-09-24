import express from "express";
import u from "@/utils";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { DownloadNeededError } from "@/utils/ai";

const router = express.Router();

// AI 配音生成：文本 + 参考音频 → 生成语音 → 落为音频资产
export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    model: z.string(),
    text: z.string(),
    referenceBase64: z.string(),
    name: z.string().optional(),
    describe: z.string().optional(),
  }),
  async (req, res) => {
    const { projectId, model, text, referenceBase64, name, describe } = req.body;

    if (!text) return res.status(400).send(error("请输入待配音的文本内容"));
    if (!referenceBase64) return res.status(400).send(error("请上传参考音频（用于克隆音色）"));

    const audioPath = `/${projectId}/assets/audio/${uuidv4()}.wav`;
    const relatedObjects = { projectId };
    const taskDescribe = describe || `AI配音生成：${text.slice(0, 30)}`;

    try {
      const aiAudio = u.Ai.Audio(model);
      await aiAudio.run(
        {
          text,
          voice: "reference",
          referenceList: [{ type: "audio", base64: referenceBase64 }],
        },
        {
          taskClass: "TTS配音生成",
          describe: taskDescribe,
          projectId,
          relatedObjects: JSON.stringify(relatedObjects),
        },
      );
      await aiAudio.save(audioPath);

      // 与 addAudioAssets 一致：父资产 + 子资产 + o_image
      const [parentId] = await u.db("o_assets").insert({
        name: name || `AI配音-${text.slice(0, 10)}`,
        describe: taskDescribe,
        type: "audio",
        projectId,
        startTime: Date.now(),
      });
      const [assetsId] = await u.db("o_assets").insert({
        prompt: text,
        assetsId: parentId,
        type: "audio",
        describe: taskDescribe,
        name: name || `AI配音-${text.slice(0, 10)}`,
        projectId,
        startTime: Date.now(),
      });
      const [imageId] = await u.db("o_image").insert({
        filePath: audioPath,
        type: "audio",
        assetsId,
        state: "已完成",
      });
      await u.db("o_assets").where("id", assetsId).update({ imageId });

      const url = await u.oss.getFileUrl(audioPath);
      return res.status(200).send(success({ id: parentId, src: audioPath, url }));
    } catch (e) {
      // 服务端下载受限：保存结果 URL，置为"待下载"，由前端引导浏览器下载后回传保存
      if (e instanceof DownloadNeededError) {
        return res.status(200).send(success({ state: "待下载", url: e.url }));
      }
      return res.status(400).send(error(u.error(e).message || "配音生成失败"));
    }
  },
);
