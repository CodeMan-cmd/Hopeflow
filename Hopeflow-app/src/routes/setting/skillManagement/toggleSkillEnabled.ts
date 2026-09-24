import express from "express";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { z } from "zod";
import { setSkillEnabled } from "@/utils/skillConfig";

const router = express.Router();

// 设置技能包启用/停用状态
export default router.post(
  "/",
  validateFields({
    path: z.string().min(1),
    enabled: z.boolean(),
  }),
  async (req, res) => {
    const { path, enabled } = req.body as { path: string; enabled: boolean };
    await setSkillEnabled(path, enabled);
    res.status(200).send(success({ path, enabled }));
  },
);
