import express from "express";
import { z } from "zod";
import u from "@/utils";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import {
  IMAGE_QUALITY_OPTIONS,
  getVideoModelModes,
  listArtStyleOptions,
  listDirectorManualOptions,
  validateProjectConfig,
} from "@/utils/projectConfig";
const router = express.Router();

/**
 * 项目配置页需要的「可选值 + 当前配置校验结果」。
 *
 * 之前这些可选值散在前端各处（画风靠 /project/getVisualManual、模式靠 /modelSelect/getModelDetail），
 * 而校验只存在于事后的 /project/diagnose。这里合并成一个入口，
 * 让配置页能在保存前就把「解析不到 / 不匹配」摆出来。
 */
export default router.post(
  "/",
  validateFields({
    projectId: z.number().optional(),
    artStyle: z.string().optional(),
    directorManual: z.string().optional(),
    imageModel: z.string().optional(),
    videoModel: z.string().optional(),
    imageQuality: z.string().optional(),
    videoRatio: z.string().optional(),
    mode: z.string().optional(),
  }),
  async (req, res) => {
    try {
      const { projectId, ...inlineInput } = req.body;

      let input = inlineInput;
      // 传了 projectId 就以库里现有配置为准，便于「打开配置页即看到问题」
      if (projectId) {
        const project = await u.db("o_project").where("id", projectId).first();
        if (project) {
          input = {
            artStyle: project.artStyle ?? "",
            directorManual: project.directorManual ?? "",
            imageModel: project.imageModel ?? "",
            videoModel: project.videoModel ?? "",
            imageQuality: project.imageQuality ?? "",
            videoRatio: project.videoRatio ?? "",
            mode: project.mode ?? "",
          };
        }
      }

      const validation = await validateProjectConfig(input, false);
      const videoModes = await getVideoModelModes(input.videoModel);

      res.status(200).send(
        success({
          artStyles: listArtStyleOptions(),
          directorManuals: listDirectorManualOptions(),
          imageQualities: IMAGE_QUALITY_OPTIONS,
          videoModes: videoModes.map((m) => ({ value: m, label: m })),
          validation,
        }),
      );
    } catch (err) {
      res.status(500).send({ message: String(err) });
    }
  },
);
