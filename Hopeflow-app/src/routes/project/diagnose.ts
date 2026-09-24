import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import fs from "fs";
import path from "path";
const router = express.Router();

export interface DiagnoseItem {
  key: string;
  status: "ok" | "warn" | "error";
  detail?: string;
}

// 校验供应商模型是否可用（供应商已启用且存在对应类型模型）
async function checkModel(type: "image" | "video", model: string | null | undefined, items: DiagnoseItem[]) {
  const key = type === "image" ? "imageModel" : "videoModel";
  if (!model) {
    items.push({ key, status: "error", detail: "未设置" });
    return;
  }
  const [vendorId, modelName] = String(model).split(/:(.+)/);
  try {
    const vendor = await u.db("o_vendorConfig").where("id", vendorId).where("enable", 1).first();
    if (!vendor) {
      items.push({ key, status: "error", detail: String(model) });
      return;
    }
    const models = await u.vendor.getModelList(String(vendorId));
    const hit = models.some((m: any) => m.modelName === modelName && m.type === type);
    items.push(hit ? { key, status: "ok" } : { key, status: "error", detail: String(model) });
  } catch {
    items.push({ key, status: "error", detail: String(model) });
  }
}

// 项目诊断：提前发现会导致下游（批量生成提示词/资产）失败的配置问题
export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
  }),
  async (req, res) => {
    try {
      const { projectId } = req.body;
      const project = await u.db("o_project").where("id", projectId).first();
      if (!project) return res.status(404).send({ error: "项目不存在" });

      const items: DiagnoseItem[] = [];

      // 1. 基础必填信息
      const missing = ["name", "type", "intro"].filter((k) => !(project as Record<string, any>)[k]);
      items.push(
        missing.length
          ? { key: "basic", status: "error", detail: missing.join(", ") }
          : { key: "basic", status: "ok" },
      );

      // 2. 画风配置：解析不到本地画风目录时，批量生成提示词会报"视觉手册未定义"
      const artStyle = (project.artStyle ?? "") as string;
      const artDir = u.resolveArtStyleDir(artStyle);
      const artRoot = u.getPath(["skills", "art_skills", artDir]);
      const requiredFiles = ["art_prompt/art_character.md", "art_prompt/art_prop.md", "art_prompt/art_scene.md"];
      if (!artStyle) {
        items.push({ key: "artStyle", status: "error", detail: "未设置画风" });
      } else if (!fs.existsSync(artRoot)) {
        items.push({ key: "artStyle", status: "error", detail: artStyle });
      } else {
        const missingFiles = requiredFiles.filter((f) => !fs.existsSync(path.join(artRoot, f)));
        items.push(
          missingFiles.length
            ? { key: "artStyle", status: "warn", detail: missingFiles.join(", ") }
            : { key: "artStyle", status: "ok" },
        );
      }

      // 3. 导演手册：story_skills 下目录是否存在（忽略大小写）
      const directorManual = (project.directorManual ?? "") as string;
      const storyRoot = u.getPath(["skills", "story_skills"]);
      let manualHit = "";
      if (fs.existsSync(storyRoot)) {
        const dirs = fs
          .readdirSync(storyRoot, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name);
        manualHit = dirs.find((d) => d.toLowerCase() === directorManual.toLowerCase()) || "";
      }
      if (!directorManual) {
        items.push({ key: "directorManual", status: "error", detail: "未设置导演手册" });
      } else if (!manualHit) {
        items.push({ key: "directorManual", status: "error", detail: directorManual });
      } else {
        items.push({ key: "directorManual", status: "ok" });
      }

      // 4/5. 图片 / 视频模型可用性
      await checkModel("image", project.imageModel, items);
      await checkModel("video", project.videoModel, items);

      // 6. 资产提示词健康度（非衍生资产）
      const assetRows = await u
        .db("o_assets")
        .where("projectId", projectId)
        .where("assetsId", null)
        .whereIn("type", ["role", "scene", "tool"])
        .select("promptState", "prompt");
      const total = assetRows.length;
      const failed = assetRows.filter((a: any) => a.promptState === "生成失败" || a.promptState === "失败").length;
      const noPrompt = assetRows.filter((a: any) => !a.prompt).length;
      if (failed > 0) {
        items.push({ key: "assets", status: "error", detail: `${failed} 个资产提示词生成失败` });
      } else if (noPrompt > 0) {
        items.push({ key: "assets", status: "warn", detail: `${noPrompt}/${total} 个资产尚未生成提示词` });
      } else {
        items.push({ key: "assets", status: "ok" });
      }

      const summary = {
        total: items.length,
        ok: items.filter((i) => i.status === "ok").length,
        warn: items.filter((i) => i.status === "warn").length,
        error: items.filter((i) => i.status === "error").length,
      };

      res.status(200).send(success({ items, summary }));
    } catch (err) {
      res.status(500).send({ error: String(err) });
    }
  },
);
