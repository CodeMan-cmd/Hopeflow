import express from "express";
import { error, success } from "@/lib/responseFormat";
import u from "@/utils";
const router = express.Router();

const DEFAULT_GPU_CONFIG = {
  hardwareAccelerate: "1", // 桌面端渲染硬件加速：1 开启 / 0 关闭
  canvasComposite: "1", // 工作台画布 GPU 合成加速：1 开启 / 0 关闭
  modelDevice: "cpu", // 向量模型推理设备：cpu | dml | auto（与记忆配置共用）
};

export default router.get("/", async (req, res) => {
  const settingData = await u.db("o_setting").whereIn("key", ["hardwareAccelerate", "canvasComposite", "modelDevice"]);

  if (!settingData) return res.status(400).send(error(`获取GPU加速配置失败`));
  const gpuObj: Record<string, string> = { ...DEFAULT_GPU_CONFIG };

  settingData.forEach((i) => {
    if (i.key && i.value) {
      gpuObj[i.key] = i.value;
    }
  });

  res.status(200).send(success(gpuObj));
});
