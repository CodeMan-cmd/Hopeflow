import express from "express";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import u from "@/utils";
import { z } from "zod";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    vendorId: z.string(),
  }),
  async (req, res) => {
    const { vendorId } = req.body;
    const list = await u
      .db("o_vendorSafetyReplacements")
      .where("vendorId", vendorId)
      .orderBy("id", "asc")
      .select("id", "vendorId", "replaceFrom", "replaceTo", "enabled", "createTime", "updateTime");
    res.status(200).send(success(list));
  },
);
