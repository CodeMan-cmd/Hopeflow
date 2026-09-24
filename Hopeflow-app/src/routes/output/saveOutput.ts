import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";

const router = express.Router();

// 保存成片：前端导出视频后回传 base64 落盘 + 写库
export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    scriptId: z.number(),
    base64: z.string(),
    duration: z.number().optional(),
    resolution: z.string().optional(),
    fileSize: z.number().optional(),
    name: z.string().optional(),
  }),
  async (req, res) => {
    const { projectId, scriptId, base64, duration, resolution, fileSize, name } = req.body;
    try {
      // 计算版本号：同一剧本下已有成片数 + 1
      const existCount: any = await u.db("o_output").where({ projectId, scriptId }).count("* as total").first();
      const version = (existCount?.total || 0) + 1;

      // 落盘路径：output/<projectId>/<scriptId>/<timestamp>.mp4
      const fileName = `${Date.now()}.mp4`;
      const filePath = `output/${projectId}/${scriptId}/${fileName}`;
      await u.oss.writeFile(filePath, base64);

      // 写库
      const scriptData = await u.db("o_script").where("id", scriptId).select("name").first();
      const outputName = name || `${scriptData?.name || "成片"}-v${version}`;

      const [id] = await u.db("o_output").insert({
        projectId,
        scriptId,
        name: outputName,
        filePath,
        duration: duration || 0,
        resolution: resolution || "",
        fileSize: fileSize || 0,
        version,
        createTime: Date.now(),
      });

      const fileUrl = await u.oss.getFileUrl(filePath);
      return res.status(200).send(success({ id, fileUrl, version, name: outputName }));
    } catch (e) {
      return res.status(400).send(error(u.error(e).message || "保存成片失败"));
    }
  },
);
