import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";

const router = express.Router();

// 更新成片：重命名 / 修改备注
export default router.post(
  "/",
  validateFields({
    id: z.number(),
    name: z.string().optional(),
    remark: z.string().optional(),
  }),
  async (req, res) => {
    const { id, name, remark } = req.body;
    const output = await u.db("o_output").where("id", id).first();
    if (!output) return res.status(400).send(error("成片记录不存在"));
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (remark !== undefined) updateData.remark = remark;
    if (Object.keys(updateData).length === 0) {
      return res.status(400).send(error("无更新字段"));
    }
    await u.db("o_output").where("id", id).update(updateData);
    res.status(200).send(success({ message: "更新成功" }));
  },
);
