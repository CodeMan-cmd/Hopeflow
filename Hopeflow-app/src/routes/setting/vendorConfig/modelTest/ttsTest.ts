import express from "express";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import u from "@/utils";
import { z } from "zod";
const router = express.Router();

// TTS 模型测试：文本 + 参考音频 → 生成语音并返回可试听地址
export default router.post(
  "/",
  validateFields({
    modelName: z.string(),
    id: z.string(),
    text: z.string(),
    referenceBase64: z.string(),
  }),
  async (req, res) => {
    const { modelName, id, text, referenceBase64 } = req.body;

    try {
      const vendorConfigData = await u.db("o_vendorConfig").where("id", id).first();
      if (!vendorConfigData) return res.status(500).send(error("未找到该供应商配置"));
      const modelList = await u.vendor.getModelList(vendorConfigData.id!);
      const selectedModel = modelList.find((i: any) => i.modelName == modelName);
      if (!selectedModel) return res.status(500).send(error("未找到该模型"));

      const reqFn = await u.Ai.Audio(`${id}:${modelName}`).run({
        text,
        voice: "reference",
        referenceList: [{ type: "audio", base64: referenceBase64 }],
      });
      await reqFn?.save("test.wav");
      const resultUrl = await u.oss.getFileUrl("test.wav");
      res.status(200).send(success(resultUrl));
    } catch (err) {
      console.error(err);
      const msg = u.error(err).message;
      console.error(msg);
      res.status(500).send(error(msg));
    }
  },
);
