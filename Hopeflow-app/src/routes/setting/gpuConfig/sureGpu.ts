import express from "express";
import u from "@/utils";
import fs from "fs";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    hardwareAccelerate: z.enum(["1", "0"]),
    canvasComposite: z.enum(["1", "0"]),
    modelDevice: z.enum(["cpu", "dml", "auto"]),
  }),
  async (req, res) => {
    const { hardwareAccelerate, canvasComposite, modelDevice } = req.body;

    const upsert = async (key: string, value: string) => {
      const exists = await u.db("o_setting").where("key", key).first();
      if (exists) {
        await u.db("o_setting").where("key", key).update({ value });
      } else {
        await u.db("o_setting").insert({ key, value });
      }
    };

    await upsert("hardwareAccelerate", hardwareAccelerate);
    await upsert("canvasComposite", canvasComposite);
    await upsert("modelDevice", modelDevice);

    // 镜像写入 gpuConfig.json，供 Electron 主进程在 app ready 前同步读取硬件加速开关
    try {
      const mirrorPath = u.getPath("gpuConfig.json");
      fs.writeFileSync(mirrorPath, JSON.stringify({ hardwareAccelerate }, null, 2), "utf-8");
    } catch (e) {
      console.error("[gpuConfig] 写入镜像文件失败:", e);
    }

    res.status(200).send(success("保存设置成功"));
  },
);
