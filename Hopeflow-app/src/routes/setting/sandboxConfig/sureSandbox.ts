import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    sandboxEngine: z.enum(["node:vm", "vm2"]),
    sandboxTimeout: z.number().int().min(100).max(60000),
  }),
  async (req, res) => {
    const { sandboxEngine, sandboxTimeout } = req.body;

    const upsert = async (key: string, value: string) => {
      const exists = await u.db("o_setting").where("key", key).first();
      if (exists) {
        await u.db("o_setting").where("key", key).update({ value });
      } else {
        await u.db("o_setting").insert({ key, value });
      }
    };

    await upsert("sandboxEngine", sandboxEngine);
    await upsert("sandboxTimeout", String(sandboxTimeout));

    res.status(200).send(success("保存设置成功"));
  },
);
