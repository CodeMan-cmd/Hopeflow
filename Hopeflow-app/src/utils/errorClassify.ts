/**
 * 报错分类与自愈建议。
 *
 * 背景：供应商（尤其 AutoDL）的报错经常「一条文案对应多个真因」——
 * 例如 `模型未部署或不支持该接口` 实际可能是 2K 尺寸不被支持，
 * 而 `Request failed with status code 400` 则是彻底没带任何线索的裸报错。
 * 这里把「原始文案 → 分类 + 人话解释 + 可执行动作」收敛到一处，
 * 避免每个路由各写一套，也避免把裸报错直接落库、直接甩给用户。
 */

export type ErrorType =
  /** 平台内容安全审核拦截 */
  | "safety"
  /** 模型未部署 / 不支持该接口 / 尺寸画质不被支持（AutoDL 400 高频混合，需并列排查） */
  | "model_or_size"
  /** 尺寸、分辨率、比例不被支持 */
  | "size"
  /** 额度、余额、限流 */
  | "quota"
  /** 首尾帧 / 参考图等模式与素材不匹配 */
  | "mode"
  /** 项目配置不合法（画风、导演手册、模型） */
  | "config"
  /** 网络、超时、网关 */
  | "network"
  /** 软件退出导致的中断 */
  | "interrupted"
  /** 前置步骤未完成（属于流程门禁，不是供应商错误） */
  | "prerequisite"
  | "unknown";

/** 界面可提供的自愈动作，前端按此渲染按钮 */
export type ErrorAction = "lowerQuality" | "rewritePrompt" | "addSafetyRule" | "checkModel" | "diagnose" | "retryFailed" | "goToConfig";

export interface ClassifiedError {
  type: ErrorType;
  /** 面向用户的一句话结论 */
  label: string;
  /** 为什么 + 怎么修 */
  hint: string;
  /** 原始报错全文，保留给「查看详情」 */
  raw: string;
  /** 分类上可重试（网络/限流类为 true） */
  retryable: boolean;
  /** 建议动作 */
  actions: ErrorAction[];
  /** 仅 safety：疑似触发词 */
  safetyWords: string[];
  /** 仅 safety：疑似触发词 → 建议替换词（供界面一键预填，用户仍可改） */
  safetySuggestions?: { from: string; to: string }[];
  /** 若分类存在歧义，这里放并列需排查的分类，供界面提示「也可能是……」 */
  alsoConsider?: ErrorType[];
}

export interface ClassifyContext {
  /** 触发失败的提示词，用于反推疑似敏感词 */
  prompt?: string;
  /** 项目画质档位，用于给出「降到 X 试试」的具体建议 */
  imageQuality?: string;
  /** 项目宽高比 */
  aspectRatio?: string;
}

/** 分类标签与建议动作的默认文案 */
const PRESET: Record<ErrorType, { label: string; hint: string; retryable: boolean; actions: ErrorAction[] }> = {
  safety: {
    label: "提示词被平台内容安全审核拦截",
    hint: "供应商侧的审核是关键词级的，同一个词在别的项目里可能也能过。建议把疑似触发词加入敏感词替换规则，或让 AI 重写这段画面描述。",
    retryable: false,
    actions: ["addSafetyRule", "rewritePrompt"],
  },
  model_or_size: {
    label: "模型不支持该接口，或当前画质/尺寸不被支持",
    hint: "这条文案有两个常见真因，按顺序排查：① 把画质降到 1K 重试（2K/4K 需要模型侧支持，失败时供应商往往也回这句话）；② 仍失败说明该模型在该供应商侧未部署。跑一次「项目诊断」可一次性确认。",
    retryable: false,
    actions: ["lowerQuality", "diagnose", "checkModel"],
  },
  size: {
    label: "画质或画面比例不被该模型支持",
    hint: "到项目配置里把画质调低一档，或换一个支持该比例/画质的图像模型。",
    retryable: false,
    actions: ["lowerQuality", "goToConfig"],
  },
  quota: {
    label: "额度不足或被限流",
    hint: "供应商侧额度耗尽或触发了速率限制，稍后重试或到供应商控制台补充额度。",
    retryable: true,
    actions: ["retryFailed"],
  },
  mode: {
    label: "生成模式与素材不匹配",
    hint: "当前视频模型要求首帧/尾帧或参考图，但本分镜没有可用的素材。先补齐上一步产物，或把视频模型换成文生视频。",
    retryable: false,
    actions: ["goToConfig", "diagnose"],
  },
  config: {
    label: "项目配置不合法",
    hint: "画风或导演手册没有解析到内置手册目录，批量生成提示词会整批失败。到项目配置里重新选择一个内置手册。",
    retryable: false,
    actions: ["goToConfig", "diagnose"],
  },
  network: {
    label: "网络或供应商网关异常",
    hint: "请求超时、被网关拒绝或服务端暂时不可用，属于瞬时故障，直接重试即可。",
    retryable: true,
    actions: ["retryFailed"],
  },
  interrupted: {
    label: "生成被中断",
    hint: "上一次生成还没返回时软件退出了，这条任务没有真的失败，重试即可。",
    retryable: true,
    actions: ["retryFailed"],
  },
  prerequisite: {
    label: "前置步骤还没完成",
    hint: "按流程顺序补齐上一步产物后再继续。",
    retryable: false,
    actions: ["goToConfig"],
  },
  unknown: {
    label: "生成失败",
    hint: "没有匹配到已知原因，可展开详情查看原始报错，或跑一次「项目诊断」。",
    retryable: true,
    actions: ["retryFailed", "diagnose"],
  },
};

/** 判定优先级的正则表，顺序敏感：先命中先归类 */
const MATCHERS: { type: ErrorType; pattern: RegExp; alsoConsider?: ErrorType[] }[] = [
  {
    type: "safety",
    pattern: /敏感词|安全审核|内容安全|风险内容|违规|sensitive_words_detected|sensitive|content[_ ]?policy|moderation|blocked by|风险词/i,
  },
  {
    // AutoDL 对「模型没部署」和「尺寸不支持」都回这句话，必须提示并列排查
    type: "model_or_size",
    pattern: /模型未部署或不支持该接口/i,
    alsoConsider: ["size", "model_or_size"],
  },
  {
    type: "model_or_size",
    pattern: /未部署|模型不存在|no such model|model not found|not deployed|不支持的模型|does not support/i,
    alsoConsider: ["size"],
  },
  {
    type: "size",
    pattern: /尺寸|分辨率|画幅|宽高比|不支持该比例|invalid size|unsupported size|image size|resolution must|too large image|aspect/i,
  },
  {
    type: "quota",
    pattern: /额度|余额|欠费|配额|限流|频率|quota|insufficient|balance|rate limit|too many requests|429|402/i,
  },
  {
    type: "mode",
    pattern: /首尾帧模式需要上传|需要上传两张图片|需要上传|需要提供提示词|需要至少上传|reference required|missing reference/i,
  },
  {
    type: "config",
    pattern: /视觉手册未定义|视觉手册|导演手册|画风|art_?style|skill.*(缺失|不存在)/i,
  },
  {
    type: "network",
    pattern: /fetch failed|network|ECONNRESET|ETIMEDOUT|socket hang up|timeout|超时|502|503|504|524|gateway/i,
  },
  {
    type: "interrupted",
    pattern: /软件退出导致失败|被中断|aborted/i,
  },
];

/**
 * 疑似敏感词候选。
 *
 * 来源说明：这里的词是**现场实测**得到的候选，不是平台公布的词表。
 * AutoDL 的过滤是关键词级且确定的（实测「文档」必被拦，「资料/文件/材料/配置文件」全过），
 * 所以用一份保守清单做「疑似」提示是有价值的；但界面必须标注为疑似，让用户自己确认。
 */
const SAFETY_REPLACEMENT_SUGGESTIONS: Record<string, string> = {
  文档: "资料",
  配置文档: "配置资料",
  文档图标: "资料图标",
  文件图标: "资料图标",
  文件夹: "资料夹",
  在黑暗中: "在暗处",
  电影级: "影视级",
  电影质感: "影视质感",
};

const SAFETY_WORD_CANDIDATES = Object.keys(SAFETY_REPLACEMENT_SUGGESTIONS);

/** 从报错原文里挖出供应商可能回传的触发词（不同供应商字段不一，做多种尝试） */
function pickWordsFromRaw(raw: string): string[] {
  const found = new Set<string>();

  // 形如 "sensitive_words": ["文档","资料"]
  const arrayMatch = raw.match(/(?:sensitive_?words?|敏感词|触发词|words?|blocked_?words?)\s*[:：=]\s*\[([^\]]*)\]/i);
  if (arrayMatch) {
    arrayMatch[1]
      .split(/[,，]/)
      .map((s) => s.replace(/["'\s]/g, ""))
      .filter(Boolean)
      .forEach((w) => found.add(w));
  }

  // 形如 敏感词：文档
  const colonMatch = raw.match(/(?:敏感词|触发词|违规词|sensitive_?word)\s*[:：]\s*([^,，;；)）\]]+)/i);
  if (colonMatch) {
    const w = colonMatch[1].replace(/["'\s]/g, "");
    if (w) found.add(w);
  }

  return [...found];
}

/**
 * 提取疑似触发词：优先用供应商回传的，拿不到再对提示词做本地候选扫描。
 * 返回值一律视为「疑似」，由用户确认。
 */
export function extractSafetyCandidates(raw: string, prompt?: string): string[] {
  const fromRaw = pickWordsFromRaw(raw);
  if (fromRaw.length) return fromRaw;

  const text = prompt ?? "";
  if (!text) return [];
  return SAFETY_WORD_CANDIDATES.filter((word) => text.includes(word));
}

function normalizeText(input: unknown): string {
  if (input instanceof Error) return `${input.name}: ${input.message}`;
  if (typeof input === "string") return input;
  if (input && typeof input === "object") {
    try {
      return JSON.stringify(input);
    } catch {
      return String(input);
    }
  }
  return String(input ?? "");
}

/**
 * 把任意报错对象/字符串归类。
 * 传入的可以是 `u.error(e)` 的结果，也可以是已落库的 reason 字符串。
 */
export function classifyError(input: unknown, ctx: ClassifyContext = {}): ClassifiedError {
  const raw = normalizeText(input).trim();

  // `u.error(e)` 的结果形如 "Error: xxx"，剥掉前缀再匹配，避免前缀干扰
  const probe = raw.replace(/^\w*Error:\s*/, "");

  for (const matcher of MATCHERS) {
    if (!matcher.pattern.test(probe) && !matcher.pattern.test(raw)) continue;
    const preset = PRESET[matcher.type];
    const result: ClassifiedError = {
      type: matcher.type,
      label: preset.label,
      hint: preset.hint,
      raw,
      retryable: preset.retryable,
      actions: [...preset.actions],
      safetyWords: [],
    };

    if (matcher.type === "safety") {
      result.safetyWords = extractSafetyCandidates(raw, ctx.prompt);
      result.safetySuggestions = result.safetyWords.map((from) => ({
        from,
        to: SAFETY_REPLACEMENT_SUGGESTIONS[from] ?? "",
      }));
      // 拿不到任何候选词时，仍然要给「让 AI 重写」这条出路
      if (!result.safetyWords.length) {
        result.hint = `${preset.hint}当前没能自动定位到具体词，可直接用「AI 重写规避」。`;
      }
    }

    if (matcher.type === "model_or_size" && ctx.imageQuality) {
      const fallback = ctx.imageQuality === "1K" ? "换一个图像模型" : "把画质降到 1K";
      result.hint = `这条文案有两个常见真因，按顺序排查：① ${fallback}后重试（2K/4K 需要模型侧支持，失败时供应商往往也回这句话）；② 仍失败说明该模型在该供应商侧未部署。跑一次「项目诊断」可一次性确认。`;
    }

    if (matcher.alsoConsider?.length) {
      result.alsoConsider = matcher.alsoConsider.filter((t) => t !== matcher.type);
    }

    return result;
  }

  const preset = PRESET.unknown;
  return {
    type: "unknown",
    label: preset.label,
    hint: preset.hint,
    raw,
    retryable: preset.retryable,
    actions: [...preset.actions],
    safetyWords: [],
  };
}

/** 只取分类代码，落库用 */
export function errorTypeOf(input: unknown, ctx: ClassifyContext = {}): ErrorType {
  return classifyError(input, ctx).type;
}

/** 构造前置条件未满足的统一报错体（带 code，前端据此走「去补上一步」而不是「重试」） */
export function prerequisiteError(message: string, detail?: Record<string, unknown>) {
  return {
    code: 400,
    errorType: "prerequisite" as ErrorType,
    message,
    ...detail,
  };
}
