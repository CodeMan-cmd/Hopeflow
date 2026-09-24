import getPath from "@/utils/getPath";
import * as fs from "fs";
import path from "path";

/**
 * 技能启用/停用配置管理。
 * 配置文件存放于 data/skills/skill-config.json，结构 { "disabled": string[] }，
 * disabled 中的相对路径（如 "art_skills/abstract_meme"、production_skills/xxx.md）视为已停用。
 */

const CONFIG_FILE = "skill-config.json";

interface SkillConfig {
  disabled: string[];
}

function toUnixPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function configPath(): string {
  return path.join(getPath("skills"), CONFIG_FILE);
}

/** 读取已停用的技能路径列表，文件缺失或损坏时返回空数组 */
export function loadDisabledSkills(): string[] {
  try {
    const raw = fs.readFileSync(configPath(), "utf-8");
    const data = JSON.parse(raw) as Partial<SkillConfig>;
    return Array.isArray(data.disabled) ? data.disabled.map(toUnixPath) : [];
  } catch {
    return [];
  }
}

/** 判断指定相对路径是否已停用 */
export function isSkillDisabled(relPath: string): boolean {
  if (!relPath) return false;
  const unix = toUnixPath(relPath).replace(/^\/+/, "");
  return loadDisabledSkills().includes(unix);
}

/** 设置指定相对路径的启用/停用状态并写回配置 */
export async function setSkillEnabled(relPath: string, enabled: boolean): Promise<void> {
  const unix = toUnixPath(relPath).replace(/^\/+/, "");
  const current = loadDisabledSkills();
  const next = enabled
    ? current.filter((p) => p !== unix)
    : current.includes(unix)
      ? current
      : [...current, unix];
  await fs.promises.writeFile(configPath(), JSON.stringify({ disabled: next }, null, 2), "utf-8");
}
