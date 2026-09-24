/**
 * Hopeflow AI供应商模板 - AutoDL.Art
 * @version 1.5
 *
 * 说明：
 * 1) 文生图（Qwen-Image / Z-Image-Turbo）：POST /api/v1/images/generations（OpenAI兼容格式）
 * 2) 视频（MiniMax H3 系列）与 TTS（IndexTTS2）：基于 ComfyUI 工作流 API（https://autodl.art/large-model/comfyui）
 *    两步异步：POST /api/v1/comfyui/comfyui_workflow/{workflow_id} 提交任务，
 *    再 GET /api/v1/comfyui/comfyui_workflow/result/{task_id} 轮询查询
 * 3) 鉴权：生图接口直接携带 Authorization: <Token>；ComfyUI 接口携带 Authorization: Bearer <Token>
 * 4) 任务成功（data.status === "SUCCESS"）后，从 data.results 中取 url（有效期短，需尽快下载）
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
  id: "autodl",
  version: "1.5",
  author: "Hopeflow",
  name: "AutoDL.Art ComfyUI",
  description:
    "AutoDL.Art 模型 API 适配，支持 Qwen-Image / Z-Image-Turbo 文生图、MiniMax H3 系列视频生成（多图参考、多图多音频、文生视频、首尾帧）与 IndexTTS2 语音合成。\n\n- 文生图使用独立的「生图Token令牌」（令牌管理创建时分组选择「大模型」），与视频/语音的 ComfyUI 令牌不同\n- 生图接口为 OpenAI 兼容格式，提交后直接返回图片地址\n- 视频/语音任务提交后异步轮询查询结果，结果 URL 有效期较短，获取后请尽快下载保存\n\n[前往令牌管理](https://autodl.art/large-model/tokens)",
  inputs: [
    { key: "imageApiKey", label: "生图Token令牌", type: "password", required: true, placeholder: "在 autodl.art 令牌管理创建，分组选择「大模型」（Qwen-Image / Z-Image-Turbo）" },
    { key: "apiKey", label: "Token令牌", type: "password", required: true, placeholder: "在 autodl.art 令牌管理创建，分组选择 ComfyUI（视频 / 语音）" },
    { key: "baseUrl", label: "请求地址", type: "url", required: true, placeholder: "默认：https://autodl.art", disabled: true },
  ],
  inputValues: { imageApiKey: "", apiKey: "", baseUrl: "https://autodl.art" },
  models: [
    {
      name: "Qwen-Image",
      modelName: "Qwen-Image",
      type: "image",
      mode: ["text"],
      associationSkills: "通义千问图像生成模型，擅长复杂文本渲染与细节刻画，支持中英文海报、分镜画面等，默认1328x1328",
    },
    {
      name: "Z-Image-Turbo",
      modelName: "Z-Image-Turbo",
      type: "image",
      mode: ["text"],
      associationSkills: "阿里通义实验室轻量文生图模型，8步极速生成、照片级真实感、中英双语文字渲染，默认1024x1024",
    },
    {
      name: "H3 多图参考生成视频",
      modelName: "minimax_h3_lightx2v_v5",
      type: "video",
      mode: [["imageReference:9"]],
      audio: false,
      durationResolutionMap: [{ duration: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], resolution: ["480p竖", "480p横", "768p竖", "768p横", "1080p横", "1080p竖"] }],
      associationSkills: "一次上传多张参考图片（1-9张），融合人物形象、服饰细节、场景氛围与视觉风格",
    },
    {
      name: "H3 文生视频",
      modelName: "minimax_h3_lightx2v_no_pic",
      type: "video",
      mode: ["text"],
      audio: false,
      durationResolutionMap: [{ duration: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], resolution: ["480p竖", "480p横", "768p竖", "768p横"] }],
      associationSkills: "仅凭提示词生成电影级画面、流畅运动与高时序一致的视频（不支持1080p）",
    },
    {
      name: "H3 首尾帧生成视频",
      modelName: "minimax_h3_lightx2v",
      type: "video",
      mode: ["startEndRequired"],
      audio: false,
      durationResolutionMap: [{ duration: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], resolution: ["480p竖", "480p横", "768p竖", "768p横"] }],
      associationSkills: "上传首帧与尾帧并结合提示词，推演两帧之间的运动轨迹（不支持1080p）",
    },
    {
      name: "H3 多图多音频生视频 15秒",
      modelName: "minimax_h3_image_audio_to_video_v2_15s",
      type: "video",
      mode: [["imageReference:9", "audioReference:3"]],
      audio: "optional",
      durationResolutionMap: [{ duration: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], resolution: ["480p竖", "480p横", "768p竖", "768p横"] }],
      associationSkills: "一次上传多张参考图片（1-9张）与多段参考音频（1-3段），多素材融合生成最长15秒视频，支持音画同步与自动对口型",
    },
    {
      name: "IndexTTS2",
      modelName: "indextts2-v1",
      type: "tts",
      voices: [{ title: "参考音频克隆", voice: "reference" }],
    },
  ],
};

// ============================================================
// 辅助工具
// ============================================================

// 获取请求头：Authorization 携带 Bearer Token
const getHeaders = () => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少Token令牌");
  const token = vendor.inputValues.apiKey.replace(/^Bearer\s+/i, "").trim();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

const getBaseUrl = () => vendor.inputValues.baseUrl.replace(/\/+$/, "");

// 提取有头 base64（referenceList 中的 base64 可能是纯 base64 或 data URL）
const withDataUrlHead = (base64: string, mimeType = "image/jpeg"): string => {
  return base64.startsWith("data:") ? base64 : `data:${mimeType};base64,${base64}`;
};

// 从响应对象中按优先级路径取值（兼容不同响应层级）
const pickFirst = (obj: any, paths: string[]): any => {
  if (!obj) return undefined;
  for (const path of paths) {
    const value = path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
};

// 提交 ComfyUI 工作流任务并轮询结果（通用函数）
const submitWorkflowAndPoll = async (workflowId: string, body: any, timeout: number): Promise<string> => {
  const baseUrl = getBaseUrl();
  const headers = getHeaders();
  const submitUrl = `${baseUrl}/api/v1/comfyui/comfyui_workflow/${workflowId}`;

  logger(`[AutoDL ComfyUI] 提交任务: ${workflowId}`);
  const submitResp: any = await axios.post(submitUrl, body, { headers });
  const submitData = submitResp.data;

  // 兼容不同响应层级：data.data.task_id 或 data.task_id
  const taskId = pickFirst(submitData, ["data.task_id", "task_id", "data.data.task_id", "data.id", "id"]);
  if (!taskId) {
    throw new Error(`任务提交失败：未获取到task_id。原始响应：${JSON.stringify(submitData).slice(0, 500)}`);
  }
  logger(`[AutoDL ComfyUI] 任务已提交，task_id: ${taskId}`);

  const pollResult = await pollTask(
    async (): Promise<PollResult> => {
      const resultUrl = `${baseUrl}/api/v1/comfyui/comfyui_workflow/result/${taskId}`;
      const resultResp: any = await axios.get(resultUrl, { headers });
      const data = resultResp.data;
      const status = String(pickFirst(data, ["data.status", "status"]) || "").toLowerCase();

      // AutoDL 实际返回 SUCCESS，兼容 completed / success / succeeded 多种写法
      if (["completed", "success", "succeeded"].includes(status)) {
        const results = pickFirst(data, ["data.results", "results"]);
        const list = Array.isArray(results) ? results : [];
        if (list.length > 0) {
          const first = list[0];
          const mediaUrl = typeof first === "string" ? first : first.url || first.image || first.video;
          if (mediaUrl) return { completed: true, data: mediaUrl };
        }
        return { completed: true, error: "任务成功但未返回结果地址" };
      }
      if (["failed", "error", "cancelled", "canceled", "expired"].includes(status)) {
        const errorMsg = pickFirst(data, ["data.error.message", "error.message", "message", "msg", "data.msg"]) || "任务生成失败";
        return { completed: true, error: errorMsg };
      }
      logger(`[AutoDL ComfyUI] 任务生成中，状态: ${status}`);
      return { completed: false };
    },
    5000,
    timeout,
  );

  if (pollResult.error) throw new Error(pollResult.error);
  if (!pollResult.data) throw new Error("任务生成失败：轮询未返回数据");
  logger(`[AutoDL ComfyUI] 任务完成，开始转换Base64，结果URL: ${pollResult.data}`);
  try {
    return await urlToBase64(pollResult.data);
  } catch (e) {
    // 服务端下载受限（如 CDN 对非浏览器指纹限速），返回原始 URL，
    // 由上层（ai.ts / 路由）降级为"待下载"，转交浏览器下载
    logger(`[AutoDL ComfyUI] 服务端下载失败，转交浏览器下载，结果URL: ${pollResult.data}`);
    return pollResult.data;
  }
};

// ============================================================
// 适配器函数
// ============================================================

const textRequest = (model: TextModel, think: boolean, thinkLevel: 0 | 1 | 2 | 3) => {
  throw new Error("AutoDL.Art 不支持文本模型");
};

// 根据宽高比与画质档位解析生图分辨率（宽x高），2K/4K 在基准分辨率上等比放大
const resolveImageSize = (modelName: string, size: string, aspectRatio: string): string => {
  const baseMap: Record<string, Record<string, string>> = {
    "Qwen-Image": {
      "1:1": "1328x1328",
      "16:9": "1664x928",
      "9:16": "928x1664",
      "4:3": "1472x1104",
      "3:4": "1104x1472",
      "3:2": "1584x1056",
      "2:3": "1056x1584",
    },
    "Z-Image-Turbo": {
      "1:1": "1024x1024",
      "16:9": "1280x720",
      "9:16": "720x1280",
      "4:3": "1152x864",
      "3:4": "864x1152",
      "3:2": "1248x832",
      "2:3": "832x1248",
    },
  };
  const base = baseMap[modelName]?.[aspectRatio] || baseMap[modelName]?.["1:1"] || "1024x1024";
  const factor = size === "4K" ? 2 : size === "2K" ? 1.414 : 1;
  if (factor === 1) return base;
  const [w, h] = base.split("x").map(Number);
  const scale = (v: number) => Math.round((v * factor) / 16) * 16;
  return `${scale(w)}x${scale(h)}`;
};

const imageRequest = async (config: ImageConfig, model: ImageModel): Promise<string> => {
  const baseUrl = getBaseUrl();
  // 生图接口使用独立的「生图Token令牌」（大模型分组），按官方文档直接携带 Token（无需 Bearer 前缀）
  const imageApiKey = (vendor.inputValues.imageApiKey || "").replace(/^Bearer\s+/i, "").trim();
  if (!imageApiKey) throw new Error("缺少生图Token令牌（请在令牌管理创建「大模型」分组的令牌）");

  const size = resolveImageSize(model.modelName, config.size, config.aspectRatio);
  const body: any = {
    n: 1,
    size,
    model: model.modelName,
    prompt: config.prompt || "",
  };
  if (!body.prompt) throw new Error("文生图模式需要提供提示词");

  logger(`[AutoDL 图像生成] 提交任务，模型: ${model.modelName}, 尺寸: ${size}`);
  let resp: any;
  try {
    resp = await axios.post(`${baseUrl}/api/v1/images/generations`, body, {
      headers: { "Content-Type": "application/json", Authorization: imageApiKey },
    });
  } catch (e: any) {
    // 透传供应商返回的具体错误信息（如安全审核拦截），避免暴露 axios 默认的 "Request failed with status code 400"
    const errData = e?.response?.data;
    let errMsg = errData?.error?.message || errData?.message || e?.message || "未知错误";
    if (errData?.error?.code === "sensitive_words_detected") {
      errMsg = "提示词包含平台安全审核限制的内容（敏感词），请调整画面描述后重试";
    }
    throw new Error(`图像生成失败，状态码: ${e?.response?.status || "未知"}, 错误信息: ${errMsg}`);
  }
  const data = resp.data;

  // 兼容 OpenAI 标准响应结构：data[0].url / data[0].b64_json
  const imageResult = pickFirst(data, ["data.0.url", "data.url", "url", "data.0.b64_json", "data.b64_json", "b64_json"]);
  if (!imageResult) {
    throw new Error(`图像生成失败：响应中未找到图片结果。原始响应：${JSON.stringify(data).slice(0, 500)}`);
  }

  if (imageResult.startsWith("data:")) return imageResult;
  if (imageResult.startsWith("http")) {
    logger(`[AutoDL 图像生成] 生成成功，开始下载图片`);
    return await urlToBase64(imageResult);
  }
  return withDataUrlHead(imageResult, "image/png");
};

const videoRequest = async (config: VideoConfig, model: VideoModel): Promise<string> => {
  const workflowId = model.modelName;
  const imageRefs = (config.referenceList || []).filter((r) => r.type === "image");
  const modeArr: any[] = Array.isArray(config.mode) ? config.mode : [config.mode];

  // 拍平多参考模式定义：兼容扁平数组 ["imageReference:9","audioReference:3"] 与嵌套 [["imageReference:9"]] 两种传入
  const refDefs: string[] = [];
  for (const m of modeArr) {
    if (Array.isArray(m)) refDefs.push(...(m as string[]));
    else refDefs.push(String(m));
  }

  const body: any = {
    prompt: config.prompt || "",
    duration: config.duration || 5,
    resolution: config.resolution || "768p竖",
  };

  if (modeArr.includes("startEndRequired")) {
    // 首尾帧生成视频：首帧 + 尾帧
    if (imageRefs.length < 2) throw new Error("首尾帧模式需要上传两张图片");
    body.first_frame = withDataUrlHead(imageRefs[0].base64);
    body.last_frame = withDataUrlHead(imageRefs[1].base64);
  } else if (refDefs.some((m) => /^(videoReference|imageReference|audioReference):\d+$/.test(m))) {
    // 多参考生成视频：ref_image_0..N（参考图片）+ ref_audio_0..N（参考音频），按 mode 声明的数量上限截断
    const audioRefs = (config.referenceList || []).filter((r) => r.type === "audio");
    if (imageRefs.length < 1 && audioRefs.length < 1) throw new Error("多参考模式需要至少上传一张参考图片或一段参考音频");
    let imageIndex = 0;
    let audioIndex = 0;
    for (const refDef of refDefs) {
      const match = refDef.match(/^(imageReference|audioReference):(\d+)$/);
      if (!match) continue;
      const maxCount = parseInt(match[2], 10);
      if (match[1] === "imageReference") {
        for (const ref of imageRefs.slice(0, maxCount)) {
          body[`ref_image_${imageIndex++}`] = withDataUrlHead(ref.base64);
        }
      } else if (match[1] === "audioReference") {
        for (const ref of audioRefs.slice(0, maxCount)) {
          body[`ref_audio_${audioIndex++}`] = withDataUrlHead(ref.base64, "audio/mpeg");
        }
      }
    }
  } else if (modeArr.includes("text")) {
    if (!config.prompt) throw new Error("文生视频模式需要提供提示词");
  }

  return await submitWorkflowAndPoll(workflowId, body, 1800000);
};

const ttsRequest = async (config: TTSConfig, model: TTSModel): Promise<string> => {
  const audioRefs = (config.referenceList || []).filter((r) => r.type === "audio");
  if (audioRefs.length < 1) throw new Error("IndexTTS2 需要上传一段参考音频（用于克隆音色）");

  const refAudio = withDataUrlHead(audioRefs[0].base64, "audio/mpeg");
  // 情绪参数保持默认值（全部归零），如需情感表达请按需调整
  const body: any = {
    prompt_text: config.text || "",
    prompt_simple: refAudio,
    emo_ref_audio: refAudio,
    emo_control_method: "使用情感参考音频",
    emo_happy: 0,
    emo_calm: 0,
    emo_sad: 0,
    emo_angry: 0,
    emo_afraid: 0,
    emo_disgusted: 0,
    emo_surprised: 0,
    emo_melancholic: 0,
    emo_random: false,
  };

  return await submitWorkflowAndPoll(model.modelName, body, 600000);
};

const checkForUpdates = async (): Promise<{ hasUpdate: boolean; latestVersion: string; notice: string }> => {
  return { hasUpdate: false, latestVersion: "1.5", notice: "修复多参考生成视频模式（图片×9、图片×9+音频×3）参考素材未传递的问题，并补充数量上限截断" };
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
