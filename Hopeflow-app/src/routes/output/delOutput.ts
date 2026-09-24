import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";

const router = express.Router();

// 删除成片：删除记录 + 落盘文件
export default router.post(
  "/",
  validateFields({
    id: z.number(),
  }),
  async (req, res) => {
    const { id } = req.body;
    const output = await u.db("o_output").where("id", id).first();
    if (!output) return res.status(400).send(error("成片记录不存在"));
    // 删除文件
    if (output.filePath) {
      try {
        await u.oss.deleteFile(output.filePath);
      } catch {
        // 文件可能已不存在，忽略
      }
    }
    await u.db("o_output").where("id", id).delete();
    res.status(200).send(success({ message: "删除成功" }));
  },
);
