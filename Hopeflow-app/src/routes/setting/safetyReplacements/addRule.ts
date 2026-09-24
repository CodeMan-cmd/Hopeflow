import express from "express";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import u from "@/utils";
import { z } from "zod";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    vendorId: z.string(),
    replaceFrom: z.string(),
    replaceTo: z.string(),
  }),
  async (req, res) => {
    const { vendorId, replaceFrom, replaceTo } = req.body;
    const from = String(replaceFrom).trim();
    const to = String(replaceTo ?? "").trim();
    if (!from) return res.status(400).send(error("触发词不能为空"));
    if (!to) return res.status(400).send(error("替换词不能为空"));

    const exists = await u.db("o_vendorSafetyReplacements").where({ vendorId, replaceFrom: from }).first();
    if (exists) return res.status(400).send(error("该供应商已存在相同的触发词规则"));

    const now = Date.now();
    const [id] = await u.db("o_vendorSafetyReplacements").insert({
      vendorId,
      replaceFrom: from,
      replaceTo: String(replaceTo ?? "").trim(),
      enabled: 1,
      createTime: now,
      updateTime: now,
    });
    res.status(200).send(success({ id }));
  },
);
