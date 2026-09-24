/**
 * Hopeflow AI供应商模板 - 火山引擎(豆包)
 * 双通道：按量付费（apiKey + api/v3 端点）与 Plan 套餐（planApiKey + api/plan/v3 端点，含语音合成）
 * @version 2.5
 */

// ============================================================
// 类型定义
// ============================================================

type VideoMode =
  | "singleImage"
  | "startEndRequired"
  | "endFrameOptional"
  | "startFrameOptional"
  | "text"
  | (`videoReference:${number}` | `imageReference:${number}` | `audioReference:${number}`)[];

interface TextModel {
  name: string;
  modelName: string;
  type: "text";
  think: boolean;
}

interface ImageModel {
  name: string;
  modelName: string;
  type: "image";
  mode: ("text" | "singleImage" | "multiReference")[];
  associationSkills?: string;
}

interface VideoModel {
  name: string;
  modelName: string;
  type: "video";
  mode: VideoMode[];
  associationSkills?: string;
  audio: "optional" | false | true;
  durationResolutionMap: { duration: number[]; resolution: string[] }[];
}

interface TTSModel {
  name: string;
  modelName: string;
  type: "tts";
  voices: { title: string; voice: string }[];
}

interface VendorConfig {
  id: string;
  version: string;
  name: string;
  author: string;
  description?: string;
  icon?: string;
  inputs: { key: string; label: string; type: "text" | "password" | "url"; required: boolean; placeholder?: string }[];
  inputValues: Record<string, string>;
  models: (TextModel | ImageModel | VideoModel | TTSModel)[];
}

type ReferenceList =
  | { type: "image"; sourceType: "base64"; base64: string }
  | { type: "audio"; sourceType: "base64"; base64: string }
  | { type: "video"; sourceType: "base64"; base64: string };

interface ImageConfig {
  prompt: string;
  referenceList?: Extract<ReferenceList, { type: "image" }>[];
  size: "1K" | "2K" | "4K";
  aspectRatio: `${number}:${number}`;
}

interface VideoConfig {
  duration: number;
  resolution: string;
  aspectRatio: "16:9" | "9:16";
  prompt: string;
  referenceList?: ReferenceList[];
  audio?: boolean;
  mode: VideoMode[];
}

interface TTSConfig {
  text: string;
  voice: string;
  speechRate: number;
  pitchRate: number;
  volume: number;
  referenceList?: Extract<ReferenceList, { type: "audio" }>[];
}

interface PollResult {
  completed: boolean;
  data?: string;
  error?: string;
}

// ============================================================
// 全局声明
// ============================================================

declare const axios: any;
declare const logger: (msg: string) => void;
declare const jsonwebtoken: any;
declare const zipImage: (base64: string, size: number) => Promise<string>;
declare const zipImageResolution: (base64: string, w: number, h: number) => Promise<string>;
declare const mergeImages: (base64Arr: string[], maxSize?: string) => Promise<string>;
declare const urlToBase64: (url: string) => Promise<string>;
declare const pollTask: (fn: () => Promise<PollResult>, interval?: number, timeout?: number) => Promise<PollResult>;
declare const createOpenAI: any;
declare const createDeepSeek: any;
declare const createZhipu: any;
declare const createQwen: any;
declare const createAnthropic: any;
declare const createOpenAICompatible: any;
declare const createXai: any;
declare const createMinimax: any;
declare const createGoogleGenerativeAI: any;
declare const exports: {
  vendor: VendorConfig;
  textRequest: (m: TextModel, t: boolean, tl: 0 | 1 | 2 | 3) => any;
  imageRequest: (c: ImageConfig, m: ImageModel) => Promise<string>;
  videoRequest: (c: VideoConfig, m: VideoModel) => Promise<string>;
  ttsRequest: (c: TTSConfig, m: TTSModel) => Promise<string>;
  checkForUpdates?: () => Promise<{ hasUpdate: boolean; latestVersion: string; notice: string }>;
  updateVendor?: () => Promise<string>;
};

// ============================================================
// 供应商配置
// ============================================================

const vendor: VendorConfig = {
  id: "volcengine",
  version: "2.5",
  author: "leeqi",
  name: "火山引擎(豆包)",
  description:
    "火山引擎豆包大模型，支持文本、图片生成、视频生成、语音合成等能力。\n\n分为按量付费与 Plan 套餐两个通道（对应两个 API Key，配套各自的请求地址）：\n- 按量付费：文本 / 图片 / 视频，请求地址以 v3 结束（如 https://ark.cn-beijing.volces.com/api/v3）\n- Plan 套餐：图片 / 视频 / 语音合成，请求地址以 plan/v3 结束（如 https://ark.cn-beijing.volces.com/api/plan/v3），语音合成需在控制台开启超额后付费\n\n需要在[火山引擎控制台](https://console.volcengine.com/ark)获取API密钥。",
  icon: "",
  inputs: [
    { key: "apiKey", label: "API密钥（按量付费）", type: "password", required: true, placeholder: "火山引擎API Key（按量付费通道）" },
    { key: "baseUrl", label: "请求地址（按量付费）", type: "url", required: true, placeholder: "以v3结束，示例：https://ark.cn-beijing.volces.com/api/v3" },
    { key: "planApiKey", label: "Plan套餐API密钥", type: "password", required: false, placeholder: "Plan套餐API Key（Plan通道，与按量Key区分）" },
    { key: "planBaseUrl", label: "Plan套餐请求地址", type: "url", required: false, placeholder: "以plan/v3结束，示例：https://ark.cn-beijing.volces.com/api/plan/v3" },
    { key: "ttsApiKey", label: "语音服务API Key", type: "password", required: false, placeholder: "语音服务API Key（控制台>API Key管理获取）" },
    { key: "ttsBaseUrl", label: "语音服务地址", type: "url", required: false, placeholder: "示例：https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional" },
  ],
  inputValues: {
    apiKey: "",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    planApiKey: "",
    planBaseUrl: "https://ark.cn-beijing.volces.com/api/plan/v3",
    ttsApiKey: "",
    ttsBaseUrl: "https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional",
  },
  models: [
    // ===================== 文本模型 - 推荐 =====================
    { name: "Doubao-Seed-2.0-Pro", modelName: "doubao-seed-2-0-pro-260215", type: "text", think: true },
    { name: "Doubao-Seed-2.0-Lite", modelName: "doubao-seed-2-0-lite-260215", type: "text", think: true },
    { name: "Doubao-Seed-2.0-Mini", modelName: "doubao-seed-2-0-mini-260215", type: "text", think: true },
    { name: "Doubao-Seed-2.0-Code-Preview", modelName: "doubao-seed-2-0-code-preview-260215", type: "text", think: true },
    { name: "Doubao-Seed-Character", modelName: "doubao-seed-character-251128", type: "text", think: false },
    // ===================== 文本模型 - 往期 =====================
    { name: "Doubao-Seed-1.8", modelName: "doubao-seed-1-8-251228", type: "text", think: true },
    { name: "Doubao-Seed-Code-Preview", modelName: "doubao-seed-code-preview-251028", type: "text", think: true },
    { name: "Doubao-Seed-1.6-Lite", modelName: "doubao-seed-1-6-lite-251015", type: "text", think: true },
    { name: "Doubao-Seed-1.6-Flash(0828)", modelName: "doubao-seed-1-6-flash-250828", type: "text", think: true },
    { name: "Doubao-Seed-1.6-Vision", modelName: "doubao-seed-1-6-vision-250815", type: "text", think: true },
    { name: "Doubao-Seed-1.6(1015)", modelName: "doubao-seed-1-6-251015", type: "text", think: true },
    { name: "Doubao-Seed-1.6(0615)", modelName: "doubao-seed-1-6-250615", type: "text", think: true },
    { name: "Doubao-Seed-1.6-Flash(0615)", modelName: "doubao-seed-1-6-flash-250615", type: "text", think: true },
    { name: "Doubao-Seed-Translation", modelName: "doubao-seed-translation-250915", type: "text", think: false },
    { name: "Doubao-1.5-Pro-32K", modelName: "doubao-1-5-pro-32k-250115", type: "text", think: false },
    { name: "Doubao-1.5-Pro-32K-Character(0715)", modelName: "doubao-1-5-pro-32k-character-250715", type: "text", think: false },
    { name: "Doubao-1.5-Pro-32K-Character(0228)", modelName: "doubao-1-5-pro-32k-character-250228", type: "text", think: false },
    { name: "Doubao-1.5-Lite-32K", modelName: "doubao-1-5-lite-32k-250115", type: "text", think: false },
    { name: "Doubao-1.5-Vision-Pro-32K", modelName: "doubao-1-5-vision-pro-32k-250115", type: "text", think: false },
    // ===================== 文本模型 - 第三方(火山引擎托管) =====================
    { name: "GLM-4-7", modelName: "glm-4-7-251222", type: "text", think: true },
    { name: "DeepSeek-V3-2", modelName: "deepseek-v3-2-251201", type: "text", think: true },
    { name: "DeepSeek-V3-1-Terminus", modelName: "deepseek-v3-1-terminus", type: "text", think: true },
    { name: "DeepSeek-V3(0324)", modelName: "deepseek-v3-250324", type: "text", think: false },
    { name: "DeepSeek-R1(0528)", modelName: "deepseek-r1-250528", type: "text", think: true },
    { name: "Qwen3-32B", modelName: "qwen3-32b-20250429", type: "text", think: false },
    { name: "Qwen3-14B", modelName: "qwen3-14b-20250429", type: "text", think: false },
    { name: "Qwen3-8B", modelName: "qwen3-8b-20250429", type: "text", think: false },
    { name: "Qwen3-0.6B", modelName: "qwen3-0-6b-20250429", type: "text", think: false },
    { name: "Qwen2.5-72B", modelName: "qwen2-5-72b-20240919", type: "text", think: false },
    { name: "GLM-4.5-Air", modelName: "glm-4-5-air", type: "text", think: false },
    // ===================== 图片生成模型 =====================
    {
      name: "Seedream-5.0",
      modelName: "doubao-seedream-5-0-260128",
      type: "image",
      mode: ["text", "singleImage", "multiReference"],
    },
    {
      name: "Seedream-5.0-Lite",
      modelName: "doubao-seedream-5-0-lite-260128",
      type: "image",
      mode: ["text", "singleImage", "multiReference"],
    },
    {
      name: "Seedream-4.5",
      modelName: "doubao-seedream-4-5-251128",
      type: "image",
      mode: ["text", "singleImage", "multiReference"],
    },
    {
      name: "Seedream-4.0",
      modelName: "doubao-seedream-4-0-250828",
      type: "image",
      mode: ["text", "singleImage", "multiReference"],
    },
    {
      name: "Seedream-3.0-T2I",
      modelName: "doubao-seedream-3-0-t2i-250415",
      type: "image",
      mode: ["text"],
    },
    // ===================== 视频生成模型 =====================
    {
      name: "Seedance-2.0(音画同生)",
      modelName: "doubao-seedance-2-0-260128",
      type: "video",
      mode: ["text", "startFrameOptional", ["imageReference:9", "videoReference:3", "audioReference:3"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["480p", "720p"] }],
    },
    {
      name: "Seedance-2.0-Fast(音画同生)",
      modelName: "doubao-seedance-2-0-fast-260128",
      type: "video",
      mode: ["text", "startFrameOptional", ["imageReference:9", "videoReference:3", "audioReference:3"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["480p", "720p"] }],
    },
    {
      name: "Seedance-1.5-Pro(音画同生)",
      modelName: "doubao-seedance-1-5-pro-251215",
      type: "video",
      mode: ["text", "startFrameOptional"],
      audio: "optional",
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12], resolution: ["480p", "720p", "1080p"] }],
    },
    {
      name: "Seedance-1.0-Pro",
      modelName: "doubao-seedance-1-0-pro-250528",
      type: "video",
      mode: ["text", "startFrameOptional"],
      audio: false,
      durationResolutionMap: [{ duration: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], resolution: ["480p", "720p", "1080p"] }],
    },
    {
      name: "Seedance-1.0-Pro-Fast",
      modelName: "doubao-seedance-1-0-pro-fast-251015",
      type: "video",
      mode: ["text", "singleImage"],
      audio: false,
      durationResolutionMap: [{ duration: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], resolution: ["480p", "720p", "1080p"] }],
    },
    {
      name: "Seedance-1.0-Lite-T2V",
      modelName: "doubao-seedance-1-0-lite-t2v-250428",
      type: "video",
      mode: ["text"],
      audio: false,
      durationResolutionMap: [{ duration: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], resolution: ["480p", "720p", "1080p"] }],
    },
    {
      name: "Seedance-1.0-Lite-I2V",
      modelName: "doubao-seedance-1-0-lite-i2v-250428",
      type: "video",
      mode: ["startFrameOptional", ["imageReference:4"]],
      audio: false,
      durationResolutionMap: [{ duration: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], resolution: ["480p", "720p", "1080p"] }],
    },
    // ===================== Plan 套餐模型（planApiKey + api/plan/v3）=====================
    // 说明：Plan 套餐模型 ID 为点号、无版本号（与按量版横杠+版本号的 ID 不同），
    //       走 planBaseUrl 通道；语音合成（seed-tts-2.0）需额外配置 ttsApiKey
    {
      name: "Seedream-5.0-Lite（Plan）",
      modelName: "doubao-seedream-5.0-lite",
      type: "image",
      mode: ["text", "singleImage", "multiReference"],
    },
    {
      name: "Seedance-1.5-Pro（Plan）",
      modelName: "doubao-seedance-1.5-pro",
      type: "video",
      mode: ["text", "startFrameOptional"],
      audio: "optional",
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12], resolution: ["480p", "720p", "1080p"] }],
    },
    {
      name: "Seedance-2.0（Plan）",
      modelName: "doubao-seedance-2.0",
      type: "video",
      mode: ["text", "startFrameOptional"],
      audio: "optional",
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["480p", "720p"] }],
    },
    {
      name: "Seedance-2.0-Fast（Plan）",
      modelName: "doubao-seedance-2.0-fast",
      type: "video",
      mode: ["text", "startFrameOptional"],
      audio: "optional",
      durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["480p", "720p"] }],
    },
    {
      name: "豆包语音合成2.0（Plan）",
      modelName: "seed-tts-2.0",
      type: "tts",
      voices: [
        { title: "Vivi 2.0", voice: "zh_female_vv_uranus_bigtts" },
        { title: "小何 2.0", voice: "zh_female_xiaohe_uranus_bigtts" },
        { title: "云舟 2.0", voice: "zh_male_m191_uranus_bigtts" },
        { title: "小天 2.0", voice: "zh_male_taocheng_uranus_bigtts" },
        { title: "灿灿", voice: "zh_female_cancan_mars_bigtts" },
        { title: "温暖阿虎", voice: "zh_male_wennuanahu_moon_bigtts" },
        { title: "清新女声", voice: "zh_female_qingxinnvsheng_mars_bigtts" },
        { title: "知性女声", voice: "zh_female_zhixingnvsheng_mars_bigtts" },
      ],
    },
  ],
};

// ============================================================
// 辅助工具
// ============================================================

const getHeaders = () => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少API Key");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${vendor.inputValues.apiKey.replace(/^Bearer\s+/i, "")}`,
  };
};

const getBaseUrl = () => vendor.inputValues.baseUrl.replace(/\/+$/, "");

// ============================================================
// Plan 套餐通道（api/plan/v3 + planApiKey，与按量通道隔离）
// ============================================================

// Plan 套餐模型清单：模型 ID 为点号、无版本号，与按量版（横杠+版本号）区分
const PLAN_MODELS = [
  "doubao-seedream-5.0-lite",
  "doubao-seedance-1.5-pro",
  "doubao-seedance-2.0",
  "doubao-seedance-2.0-fast",
  "seed-tts-2.0",
];

const isPlanModel = (modelName: string): boolean => PLAN_MODELS.includes(modelName);

const getPlanHeaders = () => {
  if (!vendor.inputValues.planApiKey) throw new Error("缺少Plan套餐API Key，请先在设置中心配置（Plan通道）");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${vendor.inputValues.planApiKey.replace(/^Bearer\s+/i, "")}`,
  };
};

const getPlanBaseUrl = () => (vendor.inputValues.planBaseUrl || "https://ark.cn-beijing.volces.com/api/plan/v3").replace(/\/+$/, "");

// 统一补充计费通道标识，便于在模型下拉中区分「按量」与「Plan套餐」（旧名称含「（Plan）」的先去重）
vendor.models.forEach((m: { modelName: string; name: string }) => {
  const suffix = isPlanModel(m.modelName) ? "（Plan套餐）" : "（按量）";
  m.name = `${m.name.replace(/（Plan）$|（Plan套餐）$|（按量）$/g, "")}${suffix}`;
});

// ============================================================
// 适配器函数
// ============================================================

const textRequest = (model: TextModel, think: boolean, thinkLevel: 0 | 1 | 2 | 3) => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少API Key");
  const apiKey = vendor.inputValues.apiKey.replace(/^Bearer\s+/i, "");

  const effortMap: Record<number, string> = {
    0: "minimal",
    1: "low",
    2: "medium",
    3: "high",
  };

  return createOpenAICompatible({
    name: "volcengine",
    baseURL: getBaseUrl(),
    apiKey,
    fetch: async (url: string, options?: RequestInit) => {
      const rawBody = JSON.parse((options?.body as string) ?? "{}");
      const modifiedBody = {
        ...rawBody,
        thinking: {
          type: "enabled",
        },
        reasoning_effort: effortMap[thinkLevel],
      };
      return await fetch(url, {
        ...options,
        body: JSON.stringify(modifiedBody),
      });
    },
  }).chatModel(model.modelName);
};

const imageRequest = async (config: ImageConfig, model: ImageModel): Promise<string> => {
  // Plan 套餐模型（Seedream-5.0-Lite 等点号 ID）走 Plan 通道，其余按量模型走按量通道
  const isPlan = isPlanModel(model.modelName);
  const baseUrl = isPlan ? getPlanBaseUrl() : getBaseUrl();
  const headers = isPlan ? getPlanHeaders() : getHeaders();

  const body: any = {
    model: model.modelName,
    prompt: config.prompt || "",
    response_format: "url",
    watermark: false,
  };

  const isOldModel = model.modelName.includes("seedream-3-0");
  // 兼容 Plan 版点号 ID（doubao-seedream-5.0-lite）与按量版横杠 ID（doubao-seedream-5-0-lite-xxx）
  const is5Lite = model.modelName.includes("seedream-5.0-lite") || model.modelName.includes("seedream-5-0-lite");

  // sequential_image_generation 仅 seedream 5.0-lite/4.5/4.0 支持
  if (!isOldModel) {
    body.sequential_image_generation = "disabled";
  }

  // 参考图片：单图为 string，多图为 array（seedream-3.0-t2i 不支持 image 参数）
  if (!isOldModel && config.referenceList && config.referenceList.length > 0) {
    const images = config.referenceList.map((ref) => ref.base64);
    body.image = images.length === 1 ? images[0] : images;
  }

  // 尺寸处理：优先使用推荐像素值，未匹配则直接传分辨率字符串让模型自行决定
  const [w, h] = config.aspectRatio.split(":").map(Number);
  const sizeTable: Record<string, Record<string, string>> = {
    "1K": {
      "1:1": "1024x1024",
      "4:3": "1152x864",
      "3:4": "864x1152",
      "16:9": "1280x720",
      "9:16": "720x1280",
      "3:2": "1248x832",
      "2:3": "832x1248",
      "21:9": "1512x648",
    },
    "2K": {
      "1:1": "2048x2048",
      "4:3": "2304x1728",
      "3:4": "1728x2304",
      "16:9": "2848x1600",
      "9:16": "1600x2848",
      "3:2": "2496x1664",
      "2:3": "1664x2496",
      "21:9": "3136x1344",
    },
    "4K": {
      "1:1": "4096x4096",
      "4:3": "4704x3520",
      "3:4": "3520x4704",
      "16:9": "5504x3040",
      "9:16": "3040x5504",
      "3:2": "4992x3328",
      "2:3": "3328x4992",
      "21:9": "6240x2656",
    },
  };

  const sizeKey = config.size || "2K";
  const ratioKey = config.aspectRatio;
  const table = sizeTable[sizeKey];

  if (table && table[ratioKey]) {
    // 推荐像素值匹配到了，但需要检查是否满足模型最低像素要求
    const [pw, ph] = table[ratioKey].split("x").map(Number);
    const totalPixels = pw * ph;
    if (isOldModel) {
      // seedream-3.0-t2i: 像素范围 [512x512, 2048x2048]
      body.size = table[ratioKey];
    } else if (totalPixels < 3686400) {
      // 1K 像素值不满足新模型最低要求，直接传 "2K" 让模型自行决定
      body.size = "2K";
    } else if (is5Lite && totalPixels > 10404496) {
      // seedream-5.0-lite 最高 10404496，4K 超限，回退传 "2K"
      body.size = "2K";
    } else {
      body.size = table[ratioKey];
    }
  } else if (isOldModel) {
    // seedream-3.0-t2i: 像素范围 [512x512, 2048x2048]，直接按比例计算
    const base = sizeKey === "1K" ? 1024 : 2048;
    const calcW = Math.min(2048, Math.round(base * Math.sqrt(w / h)));
    const calcH = Math.min(2048, Math.round(base * Math.sqrt(h / w)));
    body.size = `${Math.max(512, calcW)}x${Math.max(512, calcH)}`;
  } else {
    // 新模型未匹配推荐值时，直接传分辨率字符串（方式1），由模型根据 prompt 自行决定尺寸
    // seedream 5.0-lite 支持 "2K"/"3K"，seedream 4.5 支持 "2K"/"4K"，seedream 4.0 支持 "1K"/"2K"/"4K"
    if (is5Lite) {
      body.size = sizeKey === "4K" ? "3K" : sizeKey === "1K" ? "2K" : sizeKey;
    } else {
      body.size = sizeKey === "1K" ? "2K" : sizeKey;
    }
  }

  logger(`[图片生成] 请求模型: ${model.modelName}, 尺寸: ${body.size}`);
  const res = await fetch(`${baseUrl}/images/generations`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`图片生成请求失败: ${errorText}`);
  }
  const response = await res.json();
  logger(response);

  if (response?.error) {
    throw new Error(`图片生成失败：${response.error.message || response.error.code}`);
  }

  // 从 data 数组中提取第一张成功的图片
  if (response?.data && response.data.length > 0) {
    for (const item of response.data) {
      if (item.url) {
        return await urlToBase64(item.url);
      }
      if (item.b64_json) {
        return item.b64_json;
      }
      if (item.error) {
        throw new Error(`图片生成失败：${item.error.message || item.error.code}`);
      }
    }
  }

  throw new Error("图片生成失败：未返回有效结果");
};

const videoRequest = async (config: VideoConfig, model: VideoModel): Promise<string> => {
  // Plan 套餐模型（Seedance 点号 ID）走 Plan 通道，其余按量模型走按量通道
  const isPlan = isPlanModel(model.modelName);
  const baseUrl = isPlan ? getPlanBaseUrl() : getBaseUrl();
  const headers = isPlan ? getPlanHeaders() : getHeaders();

  const content: any[] = [];

  if (config.prompt) {
    content.push({ type: "text", text: config.prompt });
  }

  if (typeof config.mode === "string") {
    switch (config.mode) {
      case "singleImage": {
        const firstImage = config.referenceList?.find((r) => r.type === "image");
        if (firstImage) {
          content.push({
            type: "image_url",
            image_url: { url: firstImage.base64 },
            role: "first_frame",
          });
        }
        break;
      }
      case "startFrameOptional": {
        const images = config.referenceList?.filter((r) => r.type === "image") ?? [];
        if (images.length > 0) {
          content.push({
            type: "image_url",
            image_url: { url: images[0].base64 },
            role: "first_frame",
          });
          if (images.length > 1) {
            content.push({
              type: "image_url",
              image_url: { url: images[1].base64 },
              role: "last_frame",
            });
          }
        }
        break;
      }
      case "startEndRequired": {
        const images = config.referenceList?.filter((r) => r.type === "image") ?? [];
        if (images.length >= 2) {
          content.push({
            type: "image_url",
            image_url: { url: images[0].base64 },
            role: "first_frame",
          });
          content.push({
            type: "image_url",
            image_url: { url: images[1].base64 },
            role: "last_frame",
          });
        }
        break;
      }
      case "endFrameOptional": {
        const images = config.referenceList?.filter((r) => r.type === "image") ?? [];
        if (images.length > 0) {
          content.push({
            type: "image_url",
            image_url: { url: images[0].base64 },
            role: "first_frame",
          });
          if (images.length > 1) {
            content.push({
              type: "image_url",
              image_url: { url: images[1].base64 },
              role: "last_frame",
            });
          }
        }
        break;
      }
      case "text":
      default:
        break;
    }
  } else if (Array.isArray(config.mode)) {
    // 多模态参考模式：按类型分别提取并添加
    const imageRefs = config.referenceList?.filter((r) => r.type === "image") ?? [];
    const videoRefs = config.referenceList?.filter((r) => r.type === "video") ?? [];
    const audioRefs = config.referenceList?.filter((r) => r.type === "audio") ?? [];

    for (const refDef of config.mode) {
      if (typeof refDef === "string") {
        if (refDef.startsWith("imageReference:")) {
          const maxCount = parseInt(refDef.split(":")[1], 10);
          for (const ref of imageRefs.slice(0, maxCount)) {
            content.push({
              type: "image_url",
              image_url: { url: ref.base64 },
              role: "reference_image",
            });
          }
        } else if (refDef.startsWith("videoReference:")) {
          const maxCount = parseInt(refDef.split(":")[1], 10);
          for (const ref of videoRefs.slice(0, maxCount)) {
            content.push({
              type: "video_url",
              video_url: { url: ref.base64 },
              role: "reference_video",
            });
          }
        } else if (refDef.startsWith("audioReference:")) {
          const maxCount = parseInt(refDef.split(":")[1], 10);
          for (const ref of audioRefs.slice(0, maxCount)) {
            content.push({
              type: "audio_url",
              audio_url: { url: ref.base64 },
              role: "reference_audio",
            });
          }
        }
      }
    }
  }

  const body: any = {
    model: model.modelName,
    content,
    ratio: config.aspectRatio,
    duration: config.duration,
    resolution: config.resolution || "720p",
    watermark: false,
  };

  if (model.audio === "optional") {
    body.generate_audio = config.audio !== false;
  } else if (model.audio === true) {
    body.generate_audio = true;
  } else {
    body.generate_audio = false;
  }

  logger(`[视频生成] 提交任务, 模型: ${model.modelName}, 时长: ${config.duration}s, 分辨率: ${config.resolution}`);
  const res = await fetch(`${baseUrl}/contents/generations/tasks`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`视频生成任务创建失败: ${errorText}`);
  }
  const createResponse = await res.json();
  logger(createResponse);
  const taskId = createResponse?.id;

  if (!taskId) {
    throw new Error("视频生成任务创建失败：未返回任务ID");
  }

  logger(`[视频生成] 任务已创建, ID: ${taskId}`);

  const result = await pollTask(
    async (): Promise<PollResult> => {
      const queryRes = await fetch(`${baseUrl}/contents/generations/tasks/${taskId}`, {
        method: "GET",
        headers,
      });
      if (!queryRes.ok) {
        const errorText = await queryRes.text();
        throw new Error(`查询视频生成任务状态失败: ${errorText}`);
      }
      const task = await queryRes.json();

      logger(`[视频生成] 任务状态: ${JSON.stringify(task)}`);

      switch (task.status) {
        case "succeeded":
          if (task.content?.video_url) {
            return { completed: true, data: task.content.video_url };
          }
          return { completed: true, error: "任务成功但未返回视频URL" };
        case "failed":
          return { completed: true, error: task.error?.message || "视频生成失败" };
        case "expired":
          return { completed: true, error: "视频生成任务超时" };
        case "cancelled":
          return { completed: true, error: "视频生成任务已取消" };
        default:
          return { completed: false };
      }
    },
    10000,
    600000 * 3,
  );

  if (result.error) {
    throw new Error(result.error);
  }

  return result.data!;
};

const ttsRequest = async (config: TTSConfig, model: TTSModel): Promise<string> => {
  // 仅 Plan 套餐语音合成模型（seed-tts-2.0）支持 TTS 调用
  if (!model.modelName.includes("seed-tts")) return "";

  const ttsApiKey = vendor.inputValues.ttsApiKey;
  if (!ttsApiKey) throw new Error("缺少语音服务API Key（Plan语音合成需在控制台>API Key管理获取）");

  const ttsBaseUrl = (vendor.inputValues.ttsBaseUrl || "https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional").replace(/\/+$/, "");

  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Api-Key": ttsApiKey,
    "X-Api-Resource-Id": model.modelName,
    "X-Api-Request-Id": requestId,
  };

  const body: any = {
    user: { uid: "hopeflow" },
    req_params: {
      text: config.text || "",
      speaker: config.voice,
      audio_params: {
        format: "mp3",
        sample_rate: 24000,
        speech_rate: config.speechRate || 0,
        loudness_rate: config.volume || 0,
      },
    },
  };

  logger(`[TTS] 请求合成, 音色: ${config.voice}, 文本长度: ${(config.text || "").length}`);
  const res = await fetch(ttsBaseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`语音合成请求失败: ${errorText}`);
  }

  // 读取流式响应，拼接 base64 音频数据
  const responseText = await res.text();
  const lines = responseText.split("\n").filter((line) => line.trim());
  const chunks: Buffer[] = [];

  for (const line of lines) {
    try {
      const chunk = JSON.parse(line);
      if (chunk.code !== 3000) {
        throw new Error(`语音合成失败: ${chunk.message || "未知错误"}`);
      }
      if (chunk.data) {
        chunks.push(Buffer.from(chunk.data, "base64"));
      }
    } catch (e) {
      // 忽略非 JSON 行
    }
  }

  if (chunks.length === 0) {
    throw new Error("语音合成失败：未返回音频数据");
  }

  const audioBase64 = Buffer.concat(chunks).toString("base64");
  return `data:audio/mp3;base64,${audioBase64}`;
};

const checkForUpdates = async (): Promise<{ hasUpdate: boolean; latestVersion: string; notice: string }> => {
  return { hasUpdate: false, latestVersion: "2.5", notice: "" };
};

const updateVendor = async (): Promise<string> => {
  return "";
};

// ============================================================
// 导出
// ============================================================

exports.vendor = vendor;
exports.textRequest = textRequest;
exports.imageRequest = imageRequest;
exports.videoRequest = videoRequest;
exports.ttsRequest = ttsRequest;
exports.checkForUpdates = checkForUpdates;
exports.updateVendor = updateVendor;

export {};
