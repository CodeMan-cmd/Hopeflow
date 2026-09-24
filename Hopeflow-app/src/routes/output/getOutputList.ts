import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";

const router = express.Router();

// 查询成片列表：按 projectId 查询，可选 scriptId 过滤，按版本倒序
export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    scriptId: z.number().optional(),
  }),
  async (req, res) => {
    const { projectId, scriptId } = req.body;
    const query = u.db("o_output").where("projectId", projectId);
    if (scriptId) query.andWhere("scriptId", scriptId);
    const list = await query.orderBy("version", "desc");

    const data = await Promise.all(
      list.map(async (item: any) => ({
        ...item,
        fileUrl: item.filePath ? await u.oss.getFileUrl(item.filePath) : "",
      })),
    );
    res.status(200).send(success(data));
  },
);
