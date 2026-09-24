import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { validateProjectConfig } from "@/utils/projectConfig";
const router = express.Router();

// 新增项目
export default router.post(
  "/",
  validateFields({
    id: z.number(),
    name: z.string(),
    intro: z.string(),
    type: z.string(),
    artStyle: z.string(),
    directorManual: z.string(),
    videoRatio: z.string(),
    imageModel: z.string(),
    videoModel: z.string(),
    projectType: z.string(),
    imageQuality: z.string(),
    mode: z.string(),
    needAdaptation: z.string(),
  }),
  async (req, res) => {
    const { id, name, intro, type, artStyle, videoRatio, directorManual, imageModel, videoModel, imageQuality, projectType, mode, needAdaptation } = req.body;

    // 与新增走同一套落地校验：编辑时同样不允许把解析不到的画风/手册写回库
    const validation = await validateProjectConfig({
      artStyle,
      directorManual,
      imageModel,
      videoModel,
      imageQuality,
      videoRatio,
      mode,
    });
    if (!validation.ok) {
      return res.status(400).send({
        message: validation.issues[0].message,
        errorType: "config",
        errors: validation.issues.map((i) => i.message),
        issues: validation.issues,
      });
    }
    const normalized = validation.normalized;

    await u.db("o_project").where("id", id).update({
      name,
      intro,
      type,
      artStyle: normalized.artStyle ?? artStyle,
      videoRatio,
      directorManual: normalized.directorManual ?? directorManual,
      imageModel,
      videoModel,
      imageQuality: normalized.imageQuality ?? imageQuality,
      projectType,
      mode: normalized.mode ?? mode,
      needAdaptation,
    });

    res.status(200).send(success({ message: "编辑项目成功" }));
  },
);
