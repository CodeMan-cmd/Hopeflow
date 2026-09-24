/**
 * 项目配置的「落地校验」层。
 *
 * 起因：AI 建项目时 artStyle 由模型自由发挥（例如「暗黑科幻」），
 * 直接落库后系统只认能解析到 `data/skills/art_skills/` 目录的值，
 * 于是整批提示词报废（`视觉手册未定义`）。
 * 之前仓库里只有 `routes/project/diagnose.ts` 能查出这个问题，
 * 但那是**事后诊断**，保存链路上没有任何门禁。
 *
 * 这一层把可解析性检查提前到保存前，并统一返回候选值让用户重选。
 */

import fs from "fs";
import path from "path";
import u from "@/utils";
import { isSkillDisabled } from "@/utils/skillConfig";
import { resolveArtStyleDir } from "@/utils/getArtPrompt";

export interface ConfigOption {
  value: string;
  label: string;
  description?: string;
}

export type ConfigIssueCode =
  | "artStyle.unresolved"
  | "directorManual.unresolved"
  | "imageModel.missing"
  | "imageModel.unavailable"
  | "videoModel.missing"
  | "videoModel.unavailable"
  | "videoModel.modeMismatch"
  | "imageQuality.unsupported";

export interface ConfigIssue {
  field: string;
  code: ConfigIssueCode;
  message: string;
  /** 该字段可选的合法值，前端据此渲染下拉而不是让用户猜 */
  candidates?: ConfigOption[];
  /** 建议值，例如模式错配时给出模型支持的第一个模式 */
  suggestion?: string;
}

export interface ProjectConfigInput {
  artStyle?: string;
  directorManual?: string;
  imageModel?: string;
  videoModel?: string;
  imageQuality?: string;
  videoRatio?: string;
  mode?: string;
}

export interface ProjectConfigValidation {
  ok: boolean;
  issues: ConfigIssue[];
  /** 归一化后的值（能自动修正的已修正，例如 mode 回落到模型支持的模式） */
  normalized: ProjectConfigInput;
  /** 解析不到的项，仅用于提示，不阻断保存 */
  warnings: ConfigIssue[];
}

/** 画质档位，与 `resolveImageSize` 里的 factor 对应 */
export const IMAGE_QUALITY_OPTIONS: ConfigOption[] = [
  { value: "1K", label: "1K（标准）" },
  { value: "2K", label: "2K（高清）" },
  { value: "4K", label: "4K（超清）" },
];

function readTitle(dirPath: string, fallback: string): string {
  try {
    const readme = fs.readFileSync(path.join(dirPath, "README.md"), "utf-8");
    const title = readme
      .split("\n")[0]
      .replace(/^#+\s*/, "")
      .replace(/--/g, "")
      .trim();
    return title || fallback;
  } catch {
    return fallback;
  }
}

/** 列出可用的画风（= art_skills 下未被停用的目录） */
export function listArtStyleOptions(): ConfigOption[] {
  const artDir = u.getPath(["skills", "art_skills"]);
  let dirs: string[] = [];
  try {
    dirs = fs
      .readdirSync(artDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
  return dirs
    .filter((dir) => !isSkillDisabled(`art_skills/${dir}`))
    .map((dir) => ({ value: dir, label: readTitle(path.join(artDir, dir), dir) }))
    .sort((a, b) => a.value.localeCompare(b.value));
}

/** 列出可用的导演手册（= story_skills 下未被停用的目录） */
export function listDirectorManualOptions(): ConfigOption[] {
  const storyDir = u.getPath(["skills", "story_skills"]);
  let dirs: string[] = [];
  try {
    dirs = fs
      .readdirSync(storyDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
  return dirs
    .filter((dir) => !isSkillDisabled(`story_skills/${dir}`))
    .map((dir) => ({ value: dir, label: readTitle(path.join(storyDir, dir), dir) }))
    .sort((a, b) => a.value.localeCompare(b.value));
}

/** 画风是否真的能解析到目录（判断「能不能用」，而不是「长得像不像」） */
export function artStyleExists(artStyle?: string): boolean {
  if (!artStyle) return false;
  const resolved = resolveArtStyleDir(artStyle);
  if (!resolved || isSkillDisabled(`art_skills/${resolved}`)) return false;
  try {
    return fs.existsSync(u.getPath(["skills", "art_skills", resolved]));
  } catch {
    return false;
  }
}

/** 导演手册是否真的能解析到目录（忽略大小写） */
export function directorManualExists(directorManual?: string): boolean {
  if (!directorManual) return false;
  const storyDir = u.getPath(["skills", "story_skills"]);
  try {
    const dirs = fs
      .readdirSync(storyDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    return dirs.some((d) => d.toLowerCase() === directorManual.toLowerCase() && !isSkillDisabled(`story_skills/${d}`));
  } catch {
    return false;
  }
}

/** 归一化到真实存在的目录名；解析不到返回空串 */
export function resolveArtStyleValue(artStyle?: string): string {
  if (!artStyle) return "";
  const resolved = resolveArtStyleDir(artStyle);
  return artStyleExists(resolved) ? resolved : "";
}

export function resolveDirectorManualValue(directorManual?: string): string {
  if (!directorManual) return "";
  const storyDir = u.getPath(["skills", "story_skills"]);
  try {
    const dirs = fs
      .readdirSync(storyDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    return (
      dirs.find((d) => d.toLowerCase() === directorManual.toLowerCase() && !isSkillDisabled(`story_skills/${d}`)) ?? ""
    );
  } catch {
    return "";
  }
}

/** 在候选里挑最接近的若干个，方便「你是不是想选这个」 */
function pickCandidates(input: string | undefined, options: ConfigOption[], limit = 6): ConfigOption[] {
  if (!options.length) return [];
  const kw = String(input ?? "")
    .toLowerCase()
    .trim();
  if (!kw) return options.slice(0, limit);
  const scored = options
    .map((opt) => {
      const haystack = `${opt.value} ${opt.label}`.toLowerCase();
      let score = 0;
      // 双向包含：用户写的比目录名短（「暗黑科幻」⊂「暗黑科幻画风_Dark_Sci-Fi」）或反过来
      if (haystack.includes(kw)) score += 10;
      else if (kw.includes(opt.value.toLowerCase())) score += 8;
      else {
        // 退一步做字符级重合度，至少能捞出同题材的选项
        const hit = [...new Set(kw)].filter((ch) => /[\u4e00-\u9fa5a-z0-9]/.test(ch) && haystack.includes(ch)).length;
        score += hit;
      }
      return { opt, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit).map((item) => item.opt);
  return top.length ? top : options.slice(0, limit);
}

/** 把模型的 mode 声明统一成字符串 key（与前端 modeToKey 一致） */
export function modeToKey(mode: unknown): string {
  return Array.isArray(mode) ? JSON.stringify(mode) : String(mode);
}

/** 某个视频模型支持的模式 key 列表 */
export async function getVideoModelModes(videoModel?: string): Promise<string[]> {
  if (!videoModel) return [];
  const [vendorId, modelName] = String(videoModel).split(/:(.+)/);
  if (!vendorId || !modelName) return [];
  try {
    const models = await u.vendor.getModelList(String(vendorId));
    const target = models.find((m: any) => m.modelName === modelName);
    if (!target || !Array.isArray(target.mode)) return [];
    return target.mode.map((m: unknown) => modeToKey(m));
  } catch {
    return [];
  }
}

/**
 * 图像模型的画质约束。
 *
 * 两个来源，按优先级：
 * 1. 供应商模型元数据里声明的 `supportedImageQualities` / `supportedSizes`（推荐，供应商自己说了算）；
 * 2. 平台侧已知约束表（见下），用于在供应商还没声明时先挡住已知会 400 的组合。
 * 都没有则返回 unknown——此时不做硬拦截，只给软提示，避免误伤。
 */
const KNOWN_IMAGE_QUALITY_CONSTRAINTS: Record<string, { qualities: string[]; note: string }> = {
  // 现场实测：Qwen-Image / Z-Image-Turbo 走 2K 时供应商返回 400，
  // 而报错文案是「模型未部署或不支持该接口」，误导性极强。
  "autodl:Qwen-Image": { qualities: ["1K"], note: "AutoDL 侧 2K/4K 会返回 400（报错文案会误导成模型未部署）" },
  "autodl:Z-Image-Turbo": { qualities: ["1K"], note: "AutoDL 侧 2K/4K 会返回 400（报错文案会误导成模型未部署）" },
};

export interface ImageQualityConstraint {
  qualities: string[] | null;
  source: "vendor" | "known" | "unknown";
  note?: string;
}

export async function getImageQualityConstraint(imageModel?: string): Promise<ImageQualityConstraint> {
  if (!imageModel) return { qualities: null, source: "unknown" };
  const [vendorId, modelName] = String(imageModel).split(/:(.+)/);
  if (vendorId && modelName) {
    try {
      const models = await u.vendor.getModelList(String(vendorId));
      const target = models.find((m: any) => m.modelName === modelName);
      const declared: unknown = target?.supportedImageQualities ?? target?.supportedSizes;
      if (Array.isArray(declared) && declared.length) {
        return { qualities: declared.map(String), source: "vendor" };
      }
    } catch {
      /* 落到已知约束表 */
    }
  }
  const known = KNOWN_IMAGE_QUALITY_CONSTRAINTS[String(imageModel)];
  if (known) return { qualities: known.qualities, source: "known", note: known.note };
  return { qualities: null, source: "unknown" };
}

/** 校验图像/视频模型是否仍在已启用的供应商里存在 */
async function checkModelAvailable(model: string | undefined, type: "image" | "video"): Promise<boolean> {
  if (!model) return false;
  const [vendorId, modelName] = String(model).split(/:(.+)/);
  if (!vendorId || !modelName) return false;
  try {
    const vendor = await u.db("o_vendorConfig").where("id", vendorId).where("enable", 1).first();
    if (!vendor) return false;
    const models = await u.vendor.getModelList(String(vendorId));
    return models.some((m: any) => m.modelName === modelName && m.type === type);
  } catch {
    return false;
  }
}

/**
 * 校验一份项目配置。`strict` 为 true 时把所有问题都当阻断（保存前用）；
 * 为 false 时只把「必然导致下一步失败」的问题当阻断（诊断/推荐用）。
 */
export async function validateProjectConfig(input: ProjectConfigInput, strict = true): Promise<ProjectConfigValidation> {
  const issues: ConfigIssue[] = [];
  const warnings: ConfigIssue[] = [];
  const normalized: ProjectConfigInput = { ...input };

  // ---- 画风 ----
  const artStyleOptions = listArtStyleOptions();
  if (!input.artStyle) {
    if (strict) {
      issues.push({
        field: "artStyle",
        code: "artStyle.unresolved",
        message: "请选择一个画风（视觉手册）",
        candidates: artStyleOptions,
      });
    }
  } else if (!artStyleExists(input.artStyle)) {
    issues.push({
      field: "artStyle",
      code: "artStyle.unresolved",
      message: `画风「${input.artStyle}」没有对应到内置视觉手册，批量生成提示词会整批失败（视觉手册未定义）`,
      candidates: pickCandidates(input.artStyle, artStyleOptions),
      suggestion: pickCandidates(input.artStyle, artStyleOptions, 1)[0]?.value,
    });
  } else {
    normalized.artStyle = resolveArtStyleValue(input.artStyle);
  }

  // ---- 导演手册 ----
  const manualOptions = listDirectorManualOptions();
  if (!input.directorManual) {
    if (strict) {
      issues.push({
        field: "directorManual",
        code: "directorManual.unresolved",
        message: "请选择一个导演手册",
        candidates: manualOptions,
      });
    }
  } else if (!directorManualExists(input.directorManual)) {
    issues.push({
      field: "directorManual",
      code: "directorManual.unresolved",
      message: `导演手册「${input.directorManual}」没有对应到内置手册目录`,
      candidates: pickCandidates(input.directorManual, manualOptions),
      suggestion: pickCandidates(input.directorManual, manualOptions, 1)[0]?.value,
    });
  } else {
    normalized.directorManual = resolveDirectorManualValue(input.directorManual);
  }

  // ---- 图像模型 ----
  if (!input.imageModel) {
    if (strict) {
      issues.push({ field: "imageModel", code: "imageModel.missing", message: "请选择一个图像模型" });
    }
  } else if (!(await checkModelAvailable(input.imageModel, "image"))) {
    issues.push({
      field: "imageModel",
      code: "imageModel.unavailable",
      message: `图像模型「${input.imageModel}」不在已启用的供应商里`,
    });
  }

  // ---- 视频模型 + 模式联动 ----
  if (!input.videoModel) {
    if (strict) {
      issues.push({ field: "videoModel", code: "videoModel.missing", message: "请选择一个视频模型" });
    }
  } else if (!(await checkModelAvailable(input.videoModel, "video"))) {
    issues.push({
      field: "videoModel",
      code: "videoModel.unavailable",
      message: `视频模型「${input.videoModel}」不在已启用的供应商里`,
    });
  } else {
    const supported = await getVideoModelModes(input.videoModel);
    if (supported.length) {
      const requested = input.mode ? modeToKey(input.mode) : "";
      if (!requested || !supported.includes(requested)) {
        // 关键：换模型后 mode 必须跟着换，否则「首尾帧模式需要上传两张图片」之类问题在后面才炸
        issues.push({
          field: "mode",
          code: "videoModel.modeMismatch",
          message: requested
            ? `当前生成模式与视频模型不匹配，该模型只支持：${supported.join(" / ")}`
            : "请选择该视频模型支持的生成模式",
          suggestion: supported[0],
          candidates: supported.map((s) => ({ value: s, label: s })),
        });
        normalized.mode = supported[0];
      } else {
        normalized.mode = requested;
      }
    }
  }

  // ---- 画质 ----
  if (input.imageQuality) {
    const constraint = await getImageQualityConstraint(input.imageModel);
    if (constraint.qualities && !constraint.qualities.includes(input.imageQuality)) {
      issues.push({
        field: "imageQuality",
        code: "imageQuality.unsupported",
        message: `当前图像模型只支持 ${constraint.qualities.join(" / ")} 画质，${input.imageQuality} 会在生成时被供应商拒绝（${constraint.note ?? "模型侧限制"}）`,
        candidates: IMAGE_QUALITY_OPTIONS.filter((o) => constraint.qualities!.includes(o.value)),
        suggestion: constraint.qualities[0],
      });
      normalized.imageQuality = constraint.qualities[0];
    } else if (constraint.source === "unknown") {
      warnings.push({
        field: "imageQuality",
        code: "imageQuality.unsupported",
        message: `未获取到该图像模型的画质能力声明，${input.imageQuality} 是否可用要到生成时才能确认`,
      });
    }
  }

  return { ok: issues.length === 0, issues, normalized, warnings };
}
