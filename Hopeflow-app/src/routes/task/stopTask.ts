import express from "express";
import u from "@/utils";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { z } from "zod";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    taskId: z.number(),
  }),
  async (req, res) => {
    const { taskId } = req.body;
    // 仅允许停止「进行中」的任务，停止后为终态，不会被后续结果覆盖（见 taskRecord）
    const updated = await u
      .db("o_tasks")
      .where("id", taskId)
      .andWhere("state", "进行中")
      .update({ state: "已停止", reason: "用户手动停止" });
    res.status(200).send(success({ updated: updated > 0 }));
  },
);
