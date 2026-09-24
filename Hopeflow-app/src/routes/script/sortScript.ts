import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

// 排序剧本
export default router.post(
  "/",
  validateFields({
    scripts: z.array(
      z.object({
        id: z.number(),
        sort: z.number(),
      }),
    ),
  }),
  async (req, res) => {
    const { scripts } = req.body;
    try {
      await Promise.all(
        scripts.map(
          (item: { id: number; sort: number }) =>
            u.db("o_script").where("id", item.id).update({ sort: item.sort }),
        ),
      );
      res.status(200).send(success({ message: "排序成功" }));
    } catch (err) {
      console.error("剧本排序失败", err);
      res.status(500).send(error("排序失败"));
    }
  },
);
