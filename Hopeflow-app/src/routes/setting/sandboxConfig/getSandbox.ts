import express from "express";
import { error, success } from "@/lib/responseFormat";
import u from "@/utils";
const router = express.Router();

const DEFAULT_SANDBOX_CONFIG = {
  sandboxEngine: "node:vm", // 沙箱执行引擎：node:vm（推荐）| vm2（兼容兜底）
  sandboxTimeout: "3000", // 沙箱内同步代码执行超时（毫秒）
};

export default router.get("/", async (req, res) => {
  const settingData = await u.db("o_setting").whereIn("key", ["sandboxEngine", "sandboxTimeout"]);

  if (!settingData) return res.status(400).send(error(`获取沙箱配置失败`));
  const sandboxObj: Record<string, string> = { ...DEFAULT_SANDBOX_CONFIG };

  settingData.forEach((i) => {
    if (i.key && i.value) {
      sandboxObj[i.key] = i.value;
    }
  });

  res.status(200).send(success(sandboxObj));
});
