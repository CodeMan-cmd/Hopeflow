import express from "express";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import u from "@/utils";
import { z } from "zod";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    id: z.number(),
    replaceFrom: z.string().optional(),
    replaceTo: z.string().optional(),
    enabled: z.union([z.literal(0), z.literal(1)]).optional(),
  }),
  async (req, res) => {
    const { id, replaceFrom, replaceTo, enabled } = req.body;

    const updateData: Record<string, any> = { updateTime: Date.now() };
    if (replaceFrom !== undefined) {
      const from = String(replaceFrom).trim();
      if (!from) return res.status(400).send(error("触发词不能为空"));
      updateData.replaceFrom = from;
    }
    if (replaceTo !== undefined) {
      const to = String(replaceTo).trim();
      if (!to) return res.status(400).send(error("替换词不能为空"));
      updateData.replaceTo = to;
    }
    if (enabled !== undefined) updateData.enabled = enabled;

    await u.db("o_vendorSafetyReplacements").where("id", id).update(updateData);
    res.status(200).send(success("更新成功"));
  },
);
