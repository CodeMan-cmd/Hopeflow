/**
 * Hopeflow AI供应商模板 - 章鱼哥AI
 * @version 1.0
 */

// ============================================================
// 类型定义
// ============================================================

type VideoMode =
  | "singleImage" //单图参考
  | "startEndRequired" //首尾帧（两张都得有）
  | "endFrameOptional" //首尾帧（尾帧可选）
  | "startFrameOptional" //首尾帧（首帧可选）
  | "text" //文本
  | (`videoReference:${number}` | `imageReference:${number}` | `audioReference:${number}`)[]; //多参考（数字代表限制数量）

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
  id: string; //唯一ID，作为文件名存储用户磁盘上，禁止符号
  version: string; //版本号，格式为x.y，需遵守语义化版本控制
  name: string; //供应商名称
  author: string; //作者
  description?: string; //描述，支持Markdown格式
  icon?: string; //图标，仅支持Base64格式，建议尺寸为128x128像素
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

declare const axios: any; // HTTP请求库
declare const logger: (msg: string) => void; // 日志函数
declare const jsonwebtoken: any; // JWT处理库
declare const FormData: any; // 表单数据（form-data 包，用于 multipart/form-data 请求）
declare const Buffer: any; // Node.js Buffer，用于 base64 转 Buffer
declare const zipImage: (base64: string, size: number) => Promise<string>; // 图片压缩函数，返回有头base64字符串
declare const zipImageResolution: (base64: string, w: number, h: number) => Promise<string>; // 图片分辨率调整函数，返回有头base64字符串
declare const mergeImages: (base64Arr: string[], maxSize?: string) => Promise<string>; // 图片合成函数，返回有头base64字符串
declare const urlToBase64: (url: string) => Promise<string>; // URL转Base64函数，返回有头base64字符串
declare const pollTask: (fn: () => Promise<PollResult>, interval?: number, timeout?: number) => Promise<PollResult>; // 轮询函数
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
  id: "octopusai",
  version: "1.0",
  author: "Hopeflow",
  name: "章鱼哥AI",
  description: "章鱼哥AI平台适配，支持Gemini图片生成、Nano Banana图片生成、GPT Image 2图片生成、Sora/Omni/Veo视频生成。",
  inputs: [
    { key: "apiKey", label: "API密钥", type: "password", required: true },
    { key: "baseUrl", label: "请求地址", type: "url", required: true, placeholder: "示例：https://api.octopusai.com" },
  ],
  inputValues: { apiKey: "", baseUrl: "" },
  models: [
    // 图片模型 - Gemini原生格式同步
    { name: "Gemini 3 Pro Image", modelName: "gemini-3-pro-image-preview", type: "image", mode: ["text", "singleImage", "multiReference"] },
    { name: "Gemini 3.1 Flash Image", modelName: "gemini-3.1-flash-image-preview", type: "image", mode: ["text", "singleImage", "multiReference"] },
    // 图片模型 - 异步 /v1/videos
    { name: "Nano Banana 2", modelName: "nano_banana_2", type: "image", mode: ["text", "singleImage", "multiReference"] },
    { name: "Nano Banana Pro 1K", modelName: "nano_banana_pro-1K", type: "image", mode: ["text", "singleImage", "multiReference"] },
    { name: "Nano Banana Pro 2K", modelName: "nano_banana_pro-2K", type: "image", mode: ["text", "singleImage", "multiReference"] },
    { name: "Nano Banana Pro 4K", modelName: "nano_banana_pro-4K", type: "image", mode: ["text", "singleImage", "multiReference"] },
    { name: "GPT Image 2", modelName: "gpt-image-2", type: "image", mode: ["text", "singleImage", "multiReference"] },
    { name: "GPT Image 2 2K", modelName: "gpt-image-2-2K", type: "image", mode: ["text", "singleImage", "multiReference"] },
    { name: "GPT Image 2 4K", modelName: "gpt-image-2-4K", type: "image", mode: ["text", "singleImage", "multiReference"] },
    // 图片模型 - 同步 OpenAI原生格式 /v1/images/generations、/v1/images/edits
    { name: "GPT Image2 (同步)", modelName: "gpt-image2", type: "image", mode: ["text", "singleImage", "multiReference"] },
    { name: "Image2 (同步1K)", modelName: "image2", type: "image", mode: ["text", "singleImage", "multiReference"] },
    // 视频模型
    {
      name: "Sora 2 12s",
      modelName: "sora-2-12s",
      type: "video",
      mode: ["text", "singleImage"],
      audio: false,
      durationResolutionMap: [{ duration: [12], resolution: ["720p", "1080p"] }],
    },
    {
      name: "Omni Flash 10s",
      modelName: "omni_flash-10s",
      type: "video",
      mode: ["text", ["imageReference:7"]],
      audio: false,
      durationResolutionMap: [{ duration: [10], resolution: ["720p"] }],
    },
    {
      name: "Veo 3.1 Fast",
      modelName: "veo_3_1-fast",
      type: "video",
      mode: ["text", ["imageReference:3"]],
      audio: false,
      durationResolutionMap: [{ duration: [8], resolution: ["720p", "1080p"] }],
    },
    {
      name: "Veo 3.1 Fast 首尾帧",
      modelName: "veo_3_1-fast-fl",
      type: "video",
      mode: ["startEndRequired"],
      audio: false,
      durationResolutionMap: [{ duration: [8], resolution: ["720p", "1080p"] }],
    },
  ],
};

// ============================================================
// 辅助工具
// ============================================================

const getHeaders = () => {
  const apiKey = vendor.inputValues.apiKey.replace(/^Bearer\s+/i, "");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
};

const getBaseUrl = () => {
  return vendor.inputValues.baseUrl.replace(/\/+$/, "");
};

// 解析 data URI 为 mimeType 和纯 base64
const parseDataUri = (dataUri: string): { mimeType: string; data: string } => {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }
  return { mimeType: "image/jpeg", data: dataUri };
};

// 根据宽高比和分辨率档位获取像素尺寸（用于 GPT Image2 同步接口的 size 参数）
const getSyncImageSize = (size: string, aspectRatio: string): string => {
  // image2 仅支持 1K，忽略 size 参数
  const tier = size === "4K" ? 4096 : size === "2K" ? 2048 : 1024;
  const [w, h] = aspectRatio.split(":").map(Number);
  const ratio = w / h;
  if (ratio > 1) {
    return `${Math.round(tier * ratio)}x${tier}`;
  } else if (ratio < 1) {
    return `${tier}x${Math.round(tier / ratio)}`;
  }
  return `${tier}x${tier}`;
};

// 根据宽高比和分辨率获取视频尺寸
const getVideoSize = (aspectRatio: string, resolution: string): string => {
  const isLandscape = aspectRatio === "16:9";
  const res = resolution.toLowerCase();
  if (res.includes("1080")) return isLandscape ? "1920x1080" : "1080x1920";
  return isLandscape ? "1280x720" : "720x1280";
};

// 提交异步任务并轮询结果（通用，支持 JSON 和 FormData）
const submitAndPoll = async (postData: any, timeout: number, isFormData: boolean = false): Promise<string> => {
  const baseUrl = getBaseUrl();
  const apiKey = vendor.inputValues.apiKey.replace(/^Bearer\s+/i, "");

  // 构建提交请求的 headers
  let submitHeaders: any = { Authorization: `Bearer ${apiKey}` };
  if (isFormData) {
    // FormData: 由 form-data 包的 getHeaders() 设置 Content-Type（含 boundary）
    if (typeof postData.getHeaders === "function") {
      Object.assign(submitHeaders, postData.getHeaders());
    }
  } else {
    submitHeaders["Content-Type"] = "application/json";
  }

  logger(`开始提交任务，模型：${isFormData ? "unknown" : postData.model}`);
  const submitResp = await axios.post(`${baseUrl}/v1/videos`, postData, { headers: submitHeaders });
  const submitData = submitResp.data;

  const taskId = submitData.id;
  if (!taskId) {
    throw new Error(`任务提交失败：未获取到任务ID。响应：${JSON.stringify(submitData).slice(0, 500)}`);
  }
  logger(`任务提交成功，任务ID：${taskId}`);

  // 轮询时只需要 Authorization header
  const pollHeaders = { Authorization: `Bearer ${apiKey}` };

  const pollResult = await pollTask(
    async () => {
      const resp = await axios.get(`${baseUrl}/v1/videos/${taskId}`, { headers: pollHeaders });
      const data = resp.data;
      const status = data.status;

      if (status === "completed") {
        const url = data.url || data.video_url;
        if (url) return { completed: true, data: url };
        return { completed: true, error: "任务完成但未返回结果地址" };
      }
      if (status === "failed") {
        const errorMsg = data.error?.message || data.error || "任务失败";
        return { completed: true, error: errorMsg };
      }
      logger(`任务生成中，状态：${status}，进度：${data.progress ?? 0}%`);
      return { completed: false };
    },
    5000,
    timeout,
  );

  if (pollResult.error) throw new Error(pollResult.error);
  logger(`任务完成，开始转换Base64`);
  return await urlToBase64(pollResult.data!);
};

// ============================================================
// 适配器函数
// ============================================================

const textRequest = (model: TextModel, think: boolean, thinkLevel: 0 | 1 | 2 | 3) => {
  throw new Error("章鱼哥AI不支持文本模型");
};

const imageRequest = async (config: ImageConfig, model: ImageModel): Promise<string> => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少API Key");
  const baseUrl = getBaseUrl();
  const headers = getHeaders();
  const modelName = model.modelName;

  // 处理参考图
  const imageRefs = (config.referenceList || []).map((ref) => ref.base64).filter(Boolean);

  // =====================================================
  // Gemini 原生格式同步接口
  // =====================================================
  if (modelName.startsWith("gemini-")) {
    const parts: any[] = [{ text: config.prompt }];

    // 添加参考图
    for (const ref of imageRefs) {
      const { mimeType, data } = parseDataUri(ref);
      parts.push({ inlineData: { mimeType, data } });
    }

    const requestBody: any = {
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: config.aspectRatio },
      },
    };

    // gemini-3.1-flash 支持 imageSize
    if (modelName.includes("flash")) {
      requestBody.generationConfig.imageConfig.imageSize = config.size;
    }

    logger(`[Gemini图片] 开始生成，模型：${modelName}`);
    const resp = await axios.post(`${baseUrl}/v1beta/models/${modelName}:generateContent`, requestBody, { headers });
    const data = resp.data;

    // 优先从 data[0].url 取，其次从 candidates 取
    const imgUrl = data.data?.[0]?.url || data.candidates?.[0]?.content?.parts?.[0]?.image_url?.url;
    if (!imgUrl) {
      throw new Error(`图片生成失败：未获取到图片地址。响应：${JSON.stringify(data).slice(0, 500)}`);
    }
    logger(`[Gemini图片] 生成完成，开始转换Base64`);
    return await urlToBase64(imgUrl);
  }

  // =====================================================
  // GPT Image2 同步接口（OpenAI原生格式）
  // 文生图: POST /v1/images/generations
  // 图生图: POST /v1/images/edits
  // =====================================================
  if (modelName === "gpt-image2" || modelName === "image2") {
    const size = getSyncImageSize(modelName === "image2" ? "1K" : config.size, config.aspectRatio);

    if (imageRefs.length > 0) {
      // 图生图: /v1/images/edits
      const requestBody: any = {
        model: modelName,
        prompt: config.prompt,
        size,
        image: imageRefs.length === 1 ? imageRefs[0] : imageRefs,
      };
      logger(`[GPT Image2 同步] 图生图，模型：${modelName}，尺寸：${size}，参考图：${imageRefs.length}张`);
      const resp = await axios.post(`${baseUrl}/v1/images/edits`, requestBody, { headers });
      const url = resp.data?.data?.[0]?.url;
      const b64 = resp.data?.data?.[0]?.b64_json;
      if (b64) return b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`;
      if (url) return await urlToBase64(url);
      throw new Error(`图片生成失败：未获取到结果。响应：${JSON.stringify(resp.data).slice(0, 500)}`);
    } else {
      // 文生图: /v1/images/generations
      const requestBody: any = {
        model: modelName,
        prompt: config.prompt,
        size,
      };
      logger(`[GPT Image2 同步] 文生图，模型：${modelName}，尺寸：${size}`);
      const resp = await axios.post(`${baseUrl}/v1/images/generations`, requestBody, { headers });
      const url = resp.data?.data?.[0]?.url;
      const b64 = resp.data?.data?.[0]?.b64_json;
      if (b64) return b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`;
      if (url) return await urlToBase64(url);
      throw new Error(`图片生成失败：未获取到结果。响应：${JSON.stringify(resp.data).slice(0, 500)}`);
    }
  }

  // =====================================================
  // 异步 /v1/videos 接口（nano_banana / gpt-image-2）
  // =====================================================
  const requestBody: any = {
    model: modelName,
    prompt: config.prompt,
    aspect_ratio: config.aspectRatio,
  };

  // 添加参考图（图生图模式）
  if (imageRefs.length > 0) {
    requestBody.images = imageRefs;
  }

  logger(`[异步图片] 开始提交任务，模型：${modelName}`);
  return await submitAndPoll(requestBody, 600000);
};

const videoRequest = async (config: VideoConfig, model: VideoModel): Promise<string> => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少API Key");

  const modelName = model.modelName;
  const imageRefs = (config.referenceList || []).filter((r) => r.type === "image").map((r) => r.base64).filter(Boolean);
  // 归一化 mode 为数组（调用方可能传入字符串）
  const modeArr: any[] = Array.isArray(config.mode) ? config.mode : [config.mode];

  // =====================================================
  // Sora 系列：使用 aspect_ratio（非 size），图生视频使用 FormData + input_reference
  // API 文档：JSON 方式用 image_url（需 URL），表单方式用 input_reference（文件）
  // 我们只有 base64，因此图生视频走 multipart/form-data
  // =====================================================
  if (modelName.startsWith("sora-")) {
    if (imageRefs.length > 0) {
      // 图生视频：FormData + input_reference（文件上传）
      const formData = new FormData();
      formData.append("model", modelName);
      formData.append("prompt", config.prompt);
      formData.append("aspect_ratio", config.aspectRatio);

      const { mimeType, data } = parseDataUri(imageRefs[0]);
      const ext = mimeType.split("/")[1] || "jpg";
      const buffer = Buffer.from(data, "base64");
      formData.append("input_reference", buffer, { filename: `image.${ext}`, contentType: mimeType });

      logger(`[Sora视频] 开始提交图生视频任务，模型：${modelName}，比例：${config.aspectRatio}`);
      return await submitAndPoll(formData, 1800000, true);
    } else {
      // 文生视频：JSON + aspect_ratio
      const requestBody = {
        model: modelName,
        prompt: config.prompt,
        aspect_ratio: config.aspectRatio,
      };
      logger(`[Sora视频] 开始提交文生视频任务，模型：${modelName}，比例：${config.aspectRatio}`);
      return await submitAndPoll(requestBody, 1800000);
    }
  }

  // =====================================================
  // 其他视频模型（Omni/Veo）：使用 size + images 数组
  // =====================================================
  const size = getVideoSize(config.aspectRatio, config.resolution);
  const requestBody: any = {
    model: modelName,
    prompt: config.prompt,
    size,
  };

  const isStartEndRequired = modeArr.includes("startEndRequired");
  const hasImageRef = modeArr.some((m: any) => Array.isArray(m) && m.some((entry: string) => entry.startsWith("imageReference:")));

  if (isStartEndRequired) {
    // Veo 首尾帧模式：需要2张图
    if (imageRefs.length < 2) throw new Error("首尾帧模式需要2张图片");
    requestBody.images = [imageRefs[0], imageRefs[1]];
  } else if (hasImageRef && imageRefs.length > 0) {
    // 多图参考模式（Omni 最多7张，Veo 最多3张）
    requestBody.images = imageRefs;
  } else if (modeArr.includes("singleImage") && imageRefs.length > 0) {
    // 单图模式
    requestBody.images = [imageRefs[0]];
  }

  logger(`[视频] 开始提交任务，模型：${modelName}，尺寸：${size}，参考图：${imageRefs.length}张`);
  return await submitAndPoll(requestBody, 1800000);
};

const ttsRequest = async (config: TTSConfig, model: TTSModel): Promise<string> => {
  return "";
};

const checkForUpdates = async (): Promise<{ hasUpdate: boolean; latestVersion: string; notice: string }> => {
  return { hasUpdate: false, latestVersion: "1.0", notice: "" };
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

// 这行代码用于确保当前文件被识别为模块，避免全局变量冲突
export {};
