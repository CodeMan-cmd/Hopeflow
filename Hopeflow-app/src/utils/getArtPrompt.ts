import fs from "fs";
import path from "path";
import getPath from "./getPath";
import { isSkillDisabled } from "./skillConfig";

/**
 * 解析画风目录名：兼容数据库可能存储的三种格式
 * 1. 目录名（如 "abstract_meme"）
 * 2. README 标题（如 "抽象视频画风（Abstract Meme）"）
 * 3. 其他画风名称（模糊匹配 README 标题或目录名）
 * 找不到时返回传入的原始值（由调用方决定是否回退）
 */
export function resolveArtStyleDir(styleName: string): string {
  if (!styleName) return styleName;
  const artDir = getPath(["skills", "art_skills"]);
  if (!fs.existsSync(artDir)) return styleName;

  // 1. 目录名直接命中
  const direct = path.join(artDir, styleName);
  if (fs.existsSync(direct)) return styleName;

  // 2/3. 遍历目录，按 README 首行标题或目录名模糊匹配
  const kw = styleName.toLowerCase();
  const styleDirs = fs.readdirSync(artDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  for (const dir of styleDirs) {
    if (dir.toLowerCase().includes(kw) || kw.includes(dir.toLowerCase())) return dir;
    try {
      const readme = fs.readFileSync(path.join(artDir, dir, "README.md"), "utf-8");
      const title = readme.split("\n")[0].replace(/^#+\s*/, "").replace(/--/g, "").trim().toLowerCase();
      if (title.includes(kw) || kw.includes(title)) return dir;
    } catch {
      // 无 README 跳过
    }
  }
  return styleName;
}

/**
 * 传入一个指定路径参数（风格名称），以及一个指定文件名，递归获取该文件并返回其内容
 * @param styleName - 风格名称（目录名或 README 标题，自动解析目录）
 * @param fileName  - 目标文件名（不含 .md 后缀），例如 "art_character"、"prefix"
 * @returns 文件内容字符串，未找到时返回空字符串
 */
export function getArtPrompt(styleName: string, source: string, fileName: string): string {
  const resolved = resolveArtStyleDir(styleName);
  // 画风包被停用时不再注入任何内容
  if (resolved && isSkillDisabled(`${source}/${resolved}`)) return "";
  const baseDir = getPath(["skills", source, resolved]);

  if (!fs.existsSync(baseDir)) {
    return "";
  }

  // 获取 prefix.md 内容
  const prefixFile = findFileRecursive(baseDir, "prefix.md");
  const prefixContent = prefixFile ? fs.readFileSync(prefixFile, "utf-8") : "";

  const target = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
  const found = findFileRecursive(baseDir, target);

  if (!found) {
    return prefixContent;
  }

  const fileContent = fs.readFileSync(found, "utf-8");
  return prefixContent ? `${prefixContent}\n${fileContent}` : fileContent;
}
/**
 * 传入风格目录名，获取该风格下所有 .md 文件内容，按文件名映射返回
 * @param styleName - 风格目录名，例如 "chinese_sweet_romance"
 * @returns Record<文件名(不含后缀), 文件内容>
 */
export function getAllArtPrompts(styleName: string, source: string): Record<string, string> {
  const baseDir = getPath(["skills", source, styleName]);

  if (!fs.existsSync(baseDir)) {
    return {};
  }

  const result: Record<string, string> = {};
  collectMdFiles(baseDir, result);
  return result;
}

/**
 * 获取视觉手册的补充美术维度内容（光影与氛围 / 构图与镜头 / 材质与质感）
 * 依次读取对应 md 文件，缺失时跳过；不叠加 prefix，避免重复注入
 * @param styleName - 画风目录名，例如 "2D_chinese_guofeng"
 * @returns 各维度内容拼接字符串，全部缺失时返回空串
 */
export function getVisualManualDetails(styleName: string): string {
  const resolved = resolveArtStyleDir(styleName);
  // 画风包被停用时不再注入补充美术维度内容
  if (resolved && isSkillDisabled(`art_skills/${resolved}`)) return "";
  const baseDir = getPath(["skills", "art_skills", resolved]);
  if (!fs.existsSync(baseDir)) {
    return "";
  }
  const dimensionFiles = ["art_lighting_atmosphere", "art_composition_camera", "art_texture_material"];
  const parts: string[] = [];
  for (const name of dimensionFiles) {
    const found = findFileRecursive(baseDir, `${name}.md`);
    if (found) {
      parts.push(fs.readFileSync(found, "utf-8"));
    }
  }
  return parts.join("\n\n---\n\n");
}

/**
 * 递归查找指定文件名的文件，返回第一个匹配的完整路径
 */
function findFileRecursive(dir: string, targetName: string): string | null {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isFile() && entry.name === targetName) {
      return fullPath;
    }

    if (entry.isDirectory()) {
      const found = findFileRecursive(fullPath, targetName);
      if (found) return found;
    }
  }

  return null;
}

/**
 * 递归收集目录下所有 .md 文件内容
 */
function collectMdFiles(dir: string, result: Record<string, string>): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isFile() && entry.name.endsWith(".md")) {
      const key = entry.name.replace(/\.md$/, "");
      result[key] = fs.readFileSync(fullPath, "utf-8");
    }

    if (entry.isDirectory()) {
      collectMdFiles(fullPath, result);
    }
  }
}
