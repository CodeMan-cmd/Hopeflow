import express from "express";
import u from "@/utils";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { z } from "zod";
import fs from "fs";
import path from "path";
import isPathInside from "is-path-inside";
const router = express.Router();

// 保存 AI 生成的技能包：校验安全后写入 art_skills / story_skills 目录
export default router.post(
  "/",
  validateFields({
    type: z.enum(["art", "story"]),
    stylePath: z.string(),
    files: z.array(z.object({ path: z.string(), content: z.string() })),
    images: z.array(z.string()),
  }),
  async (req, res) => {
    try {
      const { type, stylePath, files, images } = req.body as {
        type: "art" | "story";
        stylePath: string;
        files: { path: string; content: string }[];
        images: string[];
      };

      // 安全校验：不允许包含路径分隔符、纯数字、空值，防止越级写入
      if (
        !stylePath ||
        stylePath.includes("/") ||
        stylePath.includes("\\") ||
        stylePath === "." ||
        stylePath === ".." ||
        /^\d+$/.test(stylePath)
      ) {
        return res.status(400).send(error("技能目录名不合法"));
      }

      const root = u.getPath(["skills", type === "art" ? "art_skills" : "story_skills", stylePath]);
      const normalizedRoot = path.resolve(root);
      if (fs.existsSync(root)) {
        return res.status(400).send(error("同名技能已存在"));
      }

      // 写入 md 文件
      for (const file of files) {
        if (!file.path || !file.content) continue;
        const filePath = path.resolve(path.join(root, file.path));
        if (!(filePath === normalizedRoot || isPathInside(filePath, normalizedRoot))) {
          return res.status(400).send(error(`文件路径越界：${file.path}`));
        }
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, file.content, "utf-8");
      }

      // 写入封面图
      const imagesDir = path.join(root, "images");
      fs.mkdirSync(imagesDir, { recursive: true });
      images.forEach((base64, index) => {
        if (!base64) return;
        const buffer = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ""), "base64");
        fs.writeFileSync(path.join(imagesDir, `${index + 1}.png`), buffer);
      });

      res.status(200).send(success());
    } catch (err) {
      res.status(500).send({ error: String(err) });
    }
  },
);
