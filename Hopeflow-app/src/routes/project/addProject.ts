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
    projectType: z.string(),
    name: z.string(),
    intro: z.string(),
    type: z.string(),
    artStyle: z.string(),
    directorManual: z.string(),
    videoRatio: z.string(),
    imageModel: z.string(),
    videoModel: z.string(),
    imageQuality: z.string(),
    mode: z.string(),
    needAdaptation: z.string(),
  }),
  async (req, res) => {
    const { projectType, name, intro, type, directorManual, artStyle, videoRatio, imageModel, videoModel, imageQuality, mode, needAdaptation } = req.body;

    // 落地校验：AI（或用户）自由发挥的 artStyle / directorManual 必须能解析到内置手册目录，
    // mode 必须与该视频模型的声明匹配，画质必须在模型支持范围内。
    // 否则落库即废——批量生成提示词会整批「视觉手册未定义」，且错误只有扒库才能看到。
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

    const id = Date.now();
    await u.db("o_project").insert({
      id,
      projectType,
      name,
      intro,
      type,
      artStyle: normalized.artStyle ?? artStyle,
      videoRatio,
      directorManual: normalized.directorManual ?? directorManual,
      userId: 1,
      imageModel,
      videoModel,
      createTime: id,
      imageQuality: normalized.imageQuality ?? imageQuality,
      mode: normalized.mode ?? mode,
      needAdaptation,
    });

    res.status(200).send(success({ id, message: "新增项目成功" }));
  },
);
