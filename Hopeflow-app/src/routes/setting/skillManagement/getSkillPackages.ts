import express from "express";
import u from "@/utils";
import { success } from "@/lib/responseFormat";
import * as fs from "fs";
import path from "path";
import { parseFrontmatter } from "@/utils/agent/skillsTools";
import { isSkillDisabled } from "@/utils/skillConfig";

const router = express.Router();

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;

// 各类型技能的归属/用途说明
const ATTRIBUTION: Record<string, string> = {
  art: "生产 Agent · 画风视觉基础：项目画风选择、资产生成、分镜提示词注入",
  story: "生产 Agent · 题材导演叙事手法：随项目题材加载",
  production: "生产 Agent · 分镜/故事板执行技法",
  agent: "剧本 Agent / 生产 Agent 主技能（决策/执行/监督）",
};

/** 读取 README 的标题（首个 # 行）与简介（标题后首个非空正文段落） */
function parseReadme(readmePath: string): { name: string; description: string } {
  try {
    const lines = fs.readFileSync(readmePath, "utf-8").split(/\r?\n/);
    let name = "";
    let description = "";
    for (const line of lines) {
      const m = line.match(/^#+\s+(.+)$/);
      if (m) {
        name = m[1].trim();
        break;
      }
    }
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith("#") || t.startsWith("|") || t.startsWith("![")) continue;
      description = t;
      break;
    }
    if (description.length > 120) description = description.slice(0, 120) + "…";
    return { name, description };
  } catch {
    return { name: "", description: "" };
  }
}

/** 读取文件首行标题（# 标题） */
function readFirstHeading(filePath: string): string {
  try {
    for (const line of fs.readFileSync(filePath, "utf-8").split(/\r?\n/)) {
      const m = line.match(/^#+\s+(.+)$/);
      if (m) return m[1].trim();
    }
  } catch {
    // 忽略读取失败
  }
  return "";
}

/** 从 images 目录挑选封面图：优先 cover.* / title.* / 1.* / preview.*，否则第一个图片 */
function pickCover(imagesDir: string): string | null {
  try {
    const files = fs.readdirSync(imagesDir).filter((f) => IMAGE_EXT.test(f));
    if (!files.length) return null;
    const prefer = (re: RegExp) => files.find((f) => re.test(f));
    return prefer(/^cover\./i) || prefer(/^title\./i) || prefer(/^1\./i) || prefer(/^preview\./i) || files[0];
  } catch {
    return null;
  }
}

/** 递归收集目录下所有 md 文件的相对路径 */
function collectMdFiles(dir: string, prefix: string): string[] {
  const result: string[] = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = path.join(prefix, entry.name).replace(/\\/g, "/");
      if (entry.isFile() && entry.name.endsWith(".md")) result.push(rel);
      else if (entry.isDirectory()) result.push(...collectMdFiles(path.join(dir, entry.name), rel));
    }
  } catch {
    // 目录不存在或不可读时返回空
  }
  return result;
}

/** 校验文件是否包含合法的 name/description frontmatter，非法时返回原因 */
function checkFrontmatter(skillsRoot: string, relPath: string): string | null {
  try {
    const parsed = parseFrontmatter(fs.readFileSync(path.join(skillsRoot, relPath), "utf-8"));
    return parsed.name && parsed.description ? null : "缺少 name 或 description frontmatter";
  } catch {
    return "缺少 name 或 description frontmatter";
  }
}

// 获取技能包列表
export default router.post("/", async (req, res) => {
  const skillsRoot = u.getPath(["skills"]);
  const packages: any[] = [];
  let issueCount = 0;

  // ── 画风包 art_skills/<dir> ──
  const artDir = path.join(skillsRoot, "art_skills");
  if (fs.existsSync(artDir)) {
    for (const entry of fs.readdirSync(artDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dirName = entry.name;
      const rel = `art_skills/${dirName}`;
      const abs = path.join(artDir, dirName);
      const readme = parseReadme(path.join(abs, "README.md"));
      const files = collectMdFiles(abs, rel);
      const coverFile = pickCover(path.join(abs, "images"));
      const coverUrl = coverFile
        ? await u.oss.getFileUrl(`art_skills/${dirName}/images/${coverFile}`, "skills")
        : "";
      const issues: { path: string; reason: string }[] = [];
      for (const f of files) {
        if (f.includes("/driector_skills/")) {
          const reason = checkFrontmatter(skillsRoot, f);
          if (reason) issues.push({ path: f.replace(`${rel}/`, ""), reason });
        }
      }
      issueCount += issues.length;
      packages.push({
        kind: "art",
        path: rel,
        name: readme.name || dirName,
        description: readme.description,
        coverUrl,
        fileCount: files.length,
        enabled: !isSkillDisabled(rel),
        toggleable: true,
        attribution: ATTRIBUTION.art,
        issues,
        files,
      });
    }
  }

  // ── 题材包 story_skills/<dir> ──
  const storyDir = path.join(skillsRoot, "story_skills");
  if (fs.existsSync(storyDir)) {
    for (const entry of fs.readdirSync(storyDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dirName = entry.name;
      const rel = `story_skills/${dirName}`;
      const abs = path.join(storyDir, dirName);
      const readme = parseReadme(path.join(abs, "README.md"));
      const files = collectMdFiles(abs, rel);
      const coverFile = pickCover(path.join(abs, "images"));
      const coverUrl = coverFile
        ? await u.oss.getFileUrl(`story_skills/${dirName}/images/${coverFile}`, "skills")
        : "";
      const issues: { path: string; reason: string }[] = [];
      for (const f of files) {
        if (f.includes("/driector_skills/")) {
          const reason = checkFrontmatter(skillsRoot, f);
          if (reason) issues.push({ path: f.replace(`${rel}/`, ""), reason });
        }
      }
      issueCount += issues.length;
      packages.push({
        kind: "story",
        path: rel,
        name: readme.name || dirName,
        description: readme.description,
        coverUrl,
        fileCount: files.length,
        enabled: !isSkillDisabled(rel),
        toggleable: true,
        attribution: ATTRIBUTION.story,
        issues,
        files,
      });
    }
  }

  // ── 生产技能 production_skills/*.md ──
  const prodDir = path.join(skillsRoot, "production_skills");
  if (fs.existsSync(prodDir)) {
    for (const fileName of fs.readdirSync(prodDir)) {
      if (!fileName.endsWith(".md")) continue;
      const rel = `production_skills/${fileName}`;
      const abs = path.join(prodDir, fileName);
      let name = "";
      let description = "";
      try {
        const parsed = parseFrontmatter(fs.readFileSync(abs, "utf-8"));
        name = parsed.name || readFirstHeading(abs);
        description = parsed.description;
      } catch {
        name = readFirstHeading(abs) || fileName.replace(/\.md$/, "");
      }
      const issue = checkFrontmatter(skillsRoot, rel);
      if (issue) issueCount++;
      packages.push({
        kind: "production",
        path: rel,
        name,
        description,
        coverUrl: "",
        fileCount: 1,
        enabled: !isSkillDisabled(rel),
        toggleable: true,
        attribution: ATTRIBUTION.production,
        issues: issue ? [{ path: fileName, reason: issue }] : [],
        files: [rel],
      });
    }
  }

  // ── Agent 主技能（skills 根目录 *.md）──
  for (const fileName of fs.readdirSync(skillsRoot)) {
    if (!fileName.endsWith(".md")) continue;
    const rel = fileName;
    const name = readFirstHeading(path.join(skillsRoot, fileName)) || fileName.replace(/\.md$/, "");
    packages.push({
      kind: "agent",
      path: rel,
      name,
      description: "",
      coverUrl: "",
      fileCount: 1,
      enabled: true,
      toggleable: false,
      attribution: ATTRIBUTION.agent,
      issues: [],
      files: [rel],
    });
  }

  res.status(200).send(
    success({
      packages,
      summary: {
        total: packages.length,
        issueCount,
        enabledCount: packages.filter((p) => p.enabled).length,
        disabledCount: packages.filter((p) => !p.enabled).length,
      },
    }),
  );
});
