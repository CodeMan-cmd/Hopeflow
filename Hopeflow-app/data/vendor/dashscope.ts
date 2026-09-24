// 阿里云百炼 DashScope 能力适配
// 1) 按量付费（apiKey，sk-ws- 开头）：
//    - 文生音色（Voice Design）：POST /api/v1/services/audio/tts/customization
//    - 图片生成（qwen-image-3.0-pro）：POST /api/v1/services/aigc/multimodal-generation/generation
// 2) Token Plan 套餐（tokenPlanApiKey，sk-sp- 开头，与按量 Key 完全隔离、不可混用）：
//    - 文本（qwen3.x / deepseek-v4 系列）：OpenAI 兼容端点 /compatible-mode/v1/chat/completions
//    - 图片（wan2.7-image / wan2.7-image-pro）：POST /api/v1/services/aigc/multimodal-generation/generation
//    - 视频（happyhorse-1.1 系列）：POST /api/v1/services/aigc/video-generation/video-synthesis（异步任务+轮询）
// 说明：音频模型（qwen-audio 系列，WebSocket/流式接口）当前仅注册展示，调用时返回友好提示
const vendor = {
  id: "dashscope",
  version: "2.1",
  author: "Hopeflow",
  name: "阿里云百炼 DashScope",
  description:
    "阿里云百炼能力适配：按量付费（CosyVoice 文生音色、qwen-image-3.0-pro 图片）与 Token Plan 套餐（qwen3.x、deepseek-v4 文本，wan2.7 图片，happyhorse 视频）",
  inputs: [
    {
      key: "apiKey",
      label: "API Key（按量付费 sk-ws-）",
      type: "text",
      required: true,
      placeholder: "sk-ws-...（按量付费，用于文生音色与 qwen-image-3.0-pro）",
    },
    {
      key: "tokenPlanApiKey",
      label: "Token Plan API Key（套餐 sk-sp-）",
      type: "text",
      required: false,
      placeholder: "sk-sp-...（订阅 Token Plan 后生成，与上方按量 Key 区分，配套套餐模型使用）",
    },
  ],
  inputValues: { apiKey: "", tokenPlanApiKey: "" },
  models: [
    // ---- 音频：文生音色（按量，仅支持文字描述生成模式）----
    {
      name: "CosyVoice 文生音色",
      modelName: "cosyvoice-v3.5-plus",
      type: "tts",
      voices: [{ title: "文字描述生成", voice: "text" }],
    },
    // ---- 音频：Token Plan（当前仅注册展示，流式/WebSocket 接口待接入）----
    {
      name: "Qwen Audio 3.0 TTS Plus",
      modelName: "qwen-audio-3.0-tts-plus",
      type: "tts",
      voices: [
        { title: "longxiaochun（女声）", voice: "longxiaochun" },
        { title: "longcheng（男声）", voice: "longcheng" },
        { title: "longmiao（女声）", voice: "longmiao" },
        { title: "longhua（男声）", voice: "longhua" },
      ],
    },
    {
      name: "Qwen Audio 3.0 ASR Flash",
      modelName: "qwen-audio-3.0-asr-flash",
      type: "tts",
      voices: [{ title: "语音识别（暂不支持）", voice: "asr" }],
    },
    {
      name: "Qwen Audio 3.0 Realtime Plus",
      modelName: "qwen-audio-3.0-realtime-plus",
      type: "tts",
      voices: [{ title: "实时对话（暂不支持）", voice: "realtime" }],
    },
    // ---- 图片：按量 ----
    {
      name: "Qwen Image 3.0 Pro",
      modelName: "qwen-image-3.0-pro",
      type: "image",
      mode: ["text", "singleImage", "multiReference"],
    },
    // ---- 图片：Token Plan（万相）----
    {
      name: "Wan 2.7 Image",
      modelName: "wan2.7-image",
      type: "image",
      mode: ["text", "singleImage"],
    },
    {
      name: "Wan 2.7 Image Pro",
      modelName: "wan2.7-image-pro",
      type: "image",
      mode: ["text", "singleImage"],
    },
    // ---- 文本：Token Plan（千问）----
    { name: "Qwen 3.8 Max", modelName: "qwen3.8-max", type: "text", think: true },
    { name: "Qwen 3.8 Flash", modelName: "qwen3.8-flash", type: "text", think: true },
    { name: "Qwen 3.7 Max", modelName: "qwen3.7-max", type: "text", think: true },
    { name: "Qwen 3.7 Plus", modelName: "qwen3.7-plus", type: "text", think: true },
    { name: "Qwen 3.6 Flash", modelName: "qwen3.6-flash", type: "text", think: true },
    // ---- 文本：Token Plan（DeepSeek）----
    { name: "DeepSeek V4 Pro 0813", modelName: "deepseek-v4-pro-0813", type: "text", think: true },
    { name: "DeepSeek V4 Flash 0731", modelName: "deepseek-v4-flash-0731", type: "text", think: true },
    { name: "DeepSeek V4 Pro", modelName: "deepseek-v4-pro", type: "text", think: true },
    // ---- 视频：Token Plan（HappyHorse）----
    {
      name: "HappyHorse 1.1 文生视频",
      modelName: "happyhorse-1.1-t2v",
      type: "video",
      mode: ["text"],
      audio: false,
      durationResolutionMap: [{ duration: [5, 10], resolution: ["480P", "720P"] }],
    },
    {
      name: "HappyHorse 1.1 图生视频",
      modelName: "happyhorse-1.1-i2v",
      type: "video",
      mode: ["singleImage"],
      audio: false,
      durationResolutionMap: [{ duration: [5, 10], resolution: ["480P", "720P"] }],
    },
    {
      name: "HappyHorse 1.1 角色参考生视频",
      modelName: "happyhorse-1.1-r2v",
      type: "video",
      mode: ["singleImage"],
      audio: false,
      durationResolutionMap: [{ duration: [5, 10], resolution: ["480P", "720P"] }],
    },
  ],
};

// ============================================================
// 全局声明（沙箱注入）
// ============================================================
declare const axios: any;
declare const logger: (msg: string) => void;
declare const urlToBase64: (url: string) => Promise<string>;
declare const pollTask: (fn: () => Promise<{ completed: boolean; data?: string; error?: string }>, interval?: number, timeout?: number) => Promise<{ completed: boolean; data?: string; error?: string }>;
declare const createOpenAICompatible: any;

// ============================================================
// 公共常量
// ============================================================

// 按量付费（DashScope 公开地域）
const DASHSCOPE_BASE = "https://dashscope.aliyuncs.com";
// Token Plan 套餐（华北2 北京地域，与按量端点隔离）
const TOKEN_PLAN_BASE = "https://token-plan.cn-beijing.maas.aliyuncs.com";

// Token Plan 套餐模型清单（其余模型为按量付费）
const TOKEN_PLAN_MODELS = [
  "qwen3.8-max",
  "qwen3.8-flash",
  "qwen3.7-max",
  "qwen3.7-plus",
  "qwen3.6-flash",
  "qwen-audio-3.0-asr-flash",
  "qwen-audio-3.0-realtime-plus",
  "qwen-audio-3.0-tts-plus",
  "wan2.7-image",
  "wan2.7-image-pro",
  "happyhorse-1.1-i2v",
  "happyhorse-1.1-t2v",
  "happyhorse-1.1-r2v",
  "deepseek-v4-pro-0813",
  "deepseek-v4-flash-0731",
  "deepseek-v4-pro",
];

// 统一补充计费通道标识，便于在模型下拉中区分「按量」与「Token Plan 套餐」
vendor.models.forEach((m: { modelName: string; name: string }) => {
  const suffix = TOKEN_PLAN_MODELS.includes(m.modelName) ? "（Token Plan）" : "（按量）";
  m.name = `${m.name.replace(/（Token Plan）$|（按量）$/g, "")}${suffix}`;
});

// 将 base64 规范为 data URI（I2I / 视频参考图输入要求）
const ensureDataUri = (base64: string): string => {
  if (/^data:image\//.test(base64)) return base64;
  return `data:image/png;base64,${base64}`;
};

/**
 * 文生音色：文字描述 → 定制音色试听音频
 * @param input.apiKey DashScope API Key（从供应商配置读取后传入，不在脚本中硬编码）
 * @param input.voicePrompt 音色描述（如「成熟慵懒男性，低沉磁性，语速舒缓」）
 * @param input.previewText 试听文本（用于生成试听音频的朗读内容）
 * @param input.responseFormat 试听音频格式，默认 mp3
 * @returns { voice, audioBase64 } voice 为音色标识，audioBase64 为纯 base64（无 data: 头）
 */
async function voiceDesign(input: {
  apiKey: string;
  voicePrompt: string;
  previewText: string;
  responseFormat?: string;
}): Promise<{ voice: string; audioBase64: string }> {
  const { apiKey, voicePrompt, previewText, responseFormat = "mp3" } = input;
  if (!apiKey) throw new Error("未配置 DashScope API Key，请先在设置中心配置");
  if (!voicePrompt.trim()) throw new Error("音色描述不能为空");
  if (!previewText.trim()) throw new Error("试听文本不能为空");

  // voice_prompt 上限 500 字符；preview_text 要求 15-200 字符，不足时自动补齐，避免接口参数校验失败
  const prompt = voicePrompt.trim().slice(0, 500);
  let preview = previewText.trim().slice(0, 200);
  if (preview.length < 15) {
    preview = `${preview}。这是一段用于试听定制音色效果的示例文本，请自然朗读。`;
  }

  const { data } = await axios.post(
    `${DASHSCOPE_BASE}/api/v1/services/audio/tts/customization`,
    {
      // CosyVoice 声音设计：model 固定为注册模型 voice-enrollment，目标合成模型在 input.target_model 指定
      model: "voice-enrollment",
      input: {
        action: "create_voice",
        target_model: "cosyvoice-v3.5-plus",
        voice_prompt: prompt,
        preview_text: preview,
      },
      parameters: {
        sample_rate: 24000,
        response_format: responseFormat,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 120000,
    },
  );

  const output = data?.output ?? {};
  const voice = output.voice ?? output.voice_id ?? "";
  // 兼容多种响应结构：output.preview_audio.data / output.preview_audio（字符串）/ output.audio / data.audio
  let audioBase64 = "";
  const previewAudio = output.preview_audio;
  if (typeof previewAudio === "string") {
    audioBase64 = previewAudio;
  } else if (previewAudio && typeof previewAudio.data === "string") {
    audioBase64 = previewAudio.data;
  } else if (typeof output.audio === "string") {
    audioBase64 = output.audio;
  } else if (typeof data?.audio === "string") {
    audioBase64 = data.audio;
  }
  audioBase64 = audioBase64.replace(/^data:audio\/\w+;base64,/, "");
  if (!audioBase64) throw new Error("文生音色接口未返回音频数据，请检查 API Key 与音色描述参数");

  return { voice, audioBase64 };
}

/**
 * 图片生成：Qwen-Image 3.0 Pro（按量）/ Wan 2.7（Token Plan），文生图 / 图生图
 * 接口：POST /api/v1/services/aigc/multimodal-generation/generation（按量与套餐端点隔离，按模型名自动分流）
 * @param config.prompt 正向提示词（支持中英文，截断至 4500 Token 以内）
 * @param config.referenceList 参考图列表（I2I，最多 3 张；为空则为文生图 T2I）
 * @param config.size 分辨率档位（1K/2K/4K，接口上限 2048*2048，4K 按 2K 处理）
 * @param config.aspectRatio 宽高比（如 "16:9"）
 * @param model 当前选中模型（用于判断按量/套餐通道）
 * @returns 图片地址（data URI 或公网 URL，由上层统一转 base64 落库）
 */
const imageRequest = async (
  config: { prompt: string; referenceList?: { type: "image"; base64: string }[]; size: "1K" | "2K" | "4K"; aspectRatio: string },
  model: { modelName: string },
): Promise<string> => {
  const modelName = model.modelName;
  // 万相系列走 Token Plan 套餐端点；qwen-image-3.0-pro 走按量端点，两者配套各自的 API Key
  const isTokenPlan = modelName.startsWith("wan2.7");
  const apiKey = isTokenPlan ? vendor.inputValues.tokenPlanApiKey : vendor.inputValues.apiKey;
  if (!apiKey) {
    throw new Error(isTokenPlan ? "未配置 Token Plan API Key（sk-sp-），请先在设置中心配置" : "未配置 DashScope API Key（sk-ws-），请先在设置中心配置");
  }
  if (!config.prompt?.trim()) throw new Error("图片描述不能为空");

  // 图生图（I2I）：1-3 张参考图，Base64 需为 data URI 格式
  const imageRefs = (config.referenceList || [])
    .filter((r) => r.type === "image" && r.base64)
    .slice(0, 3)
    .map((r) => ensureDataUri(r.base64));

  const content: { text?: string; image?: string }[] = [{ text: config.prompt.trim().slice(0, 4500) }];
  for (const ref of imageRefs) {
    content.push({ image: ref });
  }

  const baseUrl = isTokenPlan ? TOKEN_PLAN_BASE : DASHSCOPE_BASE;
  logger(`[图片生成] ${modelName} 开始生成，通道：${isTokenPlan ? "Token Plan" : "按量"}，模式：${imageRefs.length > 0 ? "图生图" : "文生图"}，参考图：${imageRefs.length} 张`);
  const { data } = await axios.post(
    `${baseUrl}/api/v1/services/aigc/multimodal-generation/generation`,
    {
      model: modelName,
      input: {
        messages: [{ role: "user", content }],
      },
      parameters: {
        prompt_extend: true,
        watermark: false,
        size: getPixelSize(config.size, config.aspectRatio),
      },
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 120000,
    },
  );

  const image = data?.output?.choices?.[0]?.message?.content?.[0]?.image;
  if (!image) {
    throw new Error(`图片生成失败：未获取到图片。响应：${JSON.stringify(data).slice(0, 500)}`);
  }
  logger(`[图片生成] ${modelName} 生成完成`);
  return image;
};

/**
 * 分辨率档位 + 宽高比 → 接口 size 参数（宽*高）
 * 接口约束：总像素 512*512 至 2048*2048，宽高比 1:8 至 8:1；未指定则由模型自动推荐
 */
const getPixelSize = (size: string, aspectRatio: string): string => {
  const [w, h] = aspectRatio.split(":").map(Number);
  if (!w || !h) return size === "1K" ? "1024*1024" : "2048*2048";
  const base = size === "1K" ? 1024 : 2048; // 2K/4K 统一 2048（接口最大边）
  let width: number;
  let height: number;
  if (w >= h) {
    width = base;
    height = Math.max(512, Math.round((base * h) / w));
  } else {
    height = base;
    width = Math.max(512, Math.round((base * w) / h));
  }
  // 极端宽高比下总像素可能超 2048*2048，等比缩放至上限
  const maxPixels = 2048 * 2048;
  if (width * height > maxPixels) {
    const scale = Math.sqrt(maxPixels / (width * height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  return `${width}*${height}`;
};

/**
 * 视频生成：HappyHorse 1.1 系列（Token Plan），异步任务：提交 → 轮询 → 返回视频地址
 * 接口：POST /api/v1/services/aigc/video-generation/video-synthesis（X-DashScope-Async: enable）
 *      查询 GET /api/v1/tasks/{task_id}
 * @param config 视频配置（prompt / referenceList / duration / resolution / aspectRatio）
 * @param model 当前选中模型（happyhorse-1.1-t2v / i2v / r2v）
 * @returns 视频地址（公网 URL，由上层统一转 base64 落库）
 */
const videoRequest = async (
  config: {
    duration: number;
    resolution: string;
    aspectRatio: "16:9" | "9:16";
    prompt: string;
    referenceList?: { type: "image" | "audio" | "video"; base64: string }[];
  },
  model: { modelName: string },
): Promise<string> => {
  const apiKey = vendor.inputValues.tokenPlanApiKey;
  if (!apiKey) throw new Error("未配置 Token Plan API Key（sk-sp-），请先在设置中心配置");
  if (!config.prompt?.trim()) throw new Error("视频描述不能为空");

  // 图生视频（i2v）/ 角色参考生视频（r2v）：取第一张参考图（data URI）作为 input.image
  const imageRefs = (config.referenceList || [])
    .filter((r) => r.type === "image" && r.base64)
    .map((r) => ensureDataUri(r.base64));

  const input: Record<string, string> = { prompt: config.prompt.trim() };
  if (imageRefs.length > 0) {
    input.image = imageRefs[0];
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-DashScope-Async": "enable",
  };

  logger(`[视频生成] ${model.modelName} 提交任务，时长：${config.duration}s，分辨率：${config.resolution}，比例：${config.aspectRatio}，参考图：${imageRefs.length} 张`);
  const submitResp = await axios.post(
    `${TOKEN_PLAN_BASE}/api/v1/services/aigc/video-generation/video-synthesis`,
    {
      model: model.modelName,
      input,
      parameters: {
        resolution: config.resolution,
        ratio: config.aspectRatio,
        duration: config.duration,
      },
    },
    { headers },
  );
  const submitData = submitResp.data;
  const taskId = submitData?.output?.task_id ?? submitData?.task_id;
  if (!taskId) {
    throw new Error(`任务提交失败：未获取到 task_id。响应：${JSON.stringify(submitData).slice(0, 500)}`);
  }
  logger(`[视频生成] 任务已提交，task_id: ${taskId}`);

  const pollHeaders = { Authorization: `Bearer ${apiKey}` };
  const pollResult = await pollTask(
    async () => {
      const resp = await axios.get(`${TOKEN_PLAN_BASE}/api/v1/tasks/${taskId}`, { headers: pollHeaders });
      const data = resp.data?.output ?? resp.data;
      const status = data.task_status;
      if (status === "SUCCEEDED") {
        const url = data.video_url;
        if (url) return { completed: true, data: url };
        return { completed: true, error: "任务完成但未返回视频地址" };
      }
      if (status === "FAILED" || status === "CANCELED") {
        return { completed: true, error: data.message || `任务${status}` };
      }
      logger(`[视频生成] 生成中，状态：${status}`);
      return { completed: false };
    },
    10000,
    600000,
  );

  if (pollResult.error) throw new Error(pollResult.error);
  logger(`[视频生成] ${model.modelName} 生成完成`);
  return pollResult.data!;
};

/**
 * 文本生成：Token Plan 套餐文本模型（qwen3.x / deepseek-v4 系列）
 * 走 OpenAI 兼容端点，返回 Vercel AI SDK LanguageModel（由上层 generateText/streamText 调用）
 * @param model 当前选中模型（含 modelName / think）
 * @param think 是否启用思考模式
 * @param thinkLevel 思考强度（仅 deepseek 系列生效，high/max 两档）
 */
const textRequest = (model: { modelName: string; think?: boolean }, think: boolean, thinkLevel: 0 | 1 | 2 | 3) => {
  const apiKey = vendor.inputValues.tokenPlanApiKey;
  if (!apiKey) throw new Error("未配置 Token Plan API Key（sk-sp-），请先在设置中心配置");

  const enableThinking = !!model.think && !!think;
  const extraBody: Record<string, any> = {
    thinking: { type: enableThinking ? "enabled" : "disabled" },
  };
  // deepseek 系列思考强度仅支持 high / max；qwen 系列沿用 thinking 协议，不传 effort
  if (enableThinking && model.modelName.startsWith("deepseek")) {
    const effortMap: Record<0 | 1 | 2 | 3, "high" | "max"> = { 0: "high", 1: "high", 2: "high", 3: "max" };
    extraBody.reasoning_effort = effortMap[thinkLevel];
  }

  return createOpenAICompatible({
    baseURL: `${TOKEN_PLAN_BASE}/compatible-mode/v1`,
    apiKey,
    fetch: async (url: string, options?: RequestInit) => {
      const rawBody = JSON.parse((options?.body as string) ?? "{}");
      return await fetch(url, {
        ...options,
        body: JSON.stringify({ ...rawBody, ...extraBody }),
      });
    },
  });
};

/**
 * TTS 请求守卫：
 * - cosyvoice-v3.5-plus：仅支持「文字描述生成」模式（请使用生成独有音色弹窗）
 * - qwen-audio 系列（Token Plan）：流式/WebSocket 接口，当前版本暂不支持
 */
const ttsRequest = async (_config: unknown, model: { modelName: string }): Promise<string> => {
  const name = model?.modelName;
  if (name === "cosyvoice-v3.5-plus") {
    throw new Error(
      "DashScope 文生音色（cosyvoice-v3.5-plus）仅支持「文字描述生成」模式，请在生成独有音色弹窗选择文字描述生成使用",
    );
  }
  if (name?.startsWith("qwen-audio-")) {
    throw new Error(`Token Plan 音频模型（${name}）当前版本暂不支持：语音合成/识别/实时对话需流式或 WebSocket 接口，待后续版本接入`);
  }
  throw new Error("该模型不支持文本转语音调用");
};

const checkForUpdates = async (): Promise<{ hasUpdate: boolean; latestVersion: string; notice: string }> => {
  return { hasUpdate: false, latestVersion: "2.1", notice: "" };
};

// ============================================================
// 导出
// ============================================================

exports.vendor = vendor;
exports.voiceDesign = voiceDesign;
exports.imageRequest = imageRequest;
exports.videoRequest = videoRequest;
exports.textRequest = textRequest;
exports.ttsRequest = ttsRequest;
exports.checkForUpdates = checkForUpdates;

// 这行代码用于确保当前文件被识别为模块，避免全局变量冲突
export {};
