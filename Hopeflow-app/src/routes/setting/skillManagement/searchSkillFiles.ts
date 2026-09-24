import express from "express";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { z } from "zod";
import fg from "fast-glob";
import u from "@/utils";
import * as fs from "fs";
import path from "path";

const router = express.Router();

// 按文件名或内容搜索技能文件
export default router.post(
  "/",
  validateFields({
    keyword: z.string(),
  }),
  async (req, res) => {
    const { keyword } = req.body as { keyword: string };
    const kw = keyword.trim().toLowerCase();
    if (!kw) return res.status(200).send(success([]));

    const skillsRoot = u.getPath(["skills"]);
    const entries = await fg("**/*.md", {
      cwd: skillsRoot.replace(/\\/g, "/"),
      onlyFiles: true,
    });

    const results: { path: string; snippet?: string }[] = [];
    for (const entry of entries) {
      if (results.length >= 200) break;
      if (entry.toLowerCase().includes(kw)) {
        results.push({ path: entry });
        continue;
      }
      try {
        const content = await fs.promises.readFile(path.join(skillsRoot, entry), "utf-8");
        const hitLine = content.split(/\r?\n/).find((l) => l.toLowerCase().includes(kw));
        if (hitLine !== undefined) {
          results.push({ path: entry, snippet: hitLine.trim().slice(0, 100) });
        }
      } catch {
        // 单个文件读取失败时跳过
      }
    }
    res.status(200).send(success(results));
  },
);
