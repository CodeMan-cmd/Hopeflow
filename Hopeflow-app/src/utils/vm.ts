import { VM } from "vm2";
import vm from "node:vm";
import sharp from "sharp";
import { createOpenAI } from "@ai-sdk/openai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createZhipu } from "zhipu-ai-provider";
import { createQwen } from "qwen-ai-provider-v5";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createXai } from "@ai-sdk/xai";
import { createMinimax } from "vercel-minimax-ai-provider";
import FormData from "form-data";
import jsonwebtoken from "jsonwebtoken";
import u from "@/utils";
import crypto from "node:crypto";

// ── 沙箱可配置项（o_setting 持久化，本地缓存 + 后台刷新，避免每次执行查库）──
const SANDBOX_CONFIG_TTL = 5000; // 配置缓存 5s
let sandboxEngine: "node:vm" | "vm2" = "node:vm";
let sandboxTimeout = 3000; // 毫秒，默认 3s
let sandboxConfigLoadedAt = 0;
let sandboxConfigRefreshing = false;

function refreshSandboxConfig(): void {
  if (sandboxConfigRefreshing) return;
  sandboxConfigRefreshing = true;
  // 复用 u.db（已在本模块导入 u），避免引入 vm→db 新循环依赖边
  u.db("o_setting")
    .whereIn("key", ["sandboxEngine", "sandboxTimeout"])
    .then((rows) => {
      const map: Record<string, string> = {};
      for (const r of rows) {
        if (r.key != null) map[r.key] = String(r.value ?? "");
      }
      sandboxEngine = map.sandboxEngine === "vm2" ? "vm2" : "node:vm";
      let t = Number(map.sandboxTimeout);
      if (!Number.isFinite(t) || t <= 0) t = 3000;
      sandboxTimeout = Math.min(60000, Math.max(100, Math.round(t)));
      sandboxConfigLoadedAt = Date.now();
    })
    .catch(() => {})
    .finally(() => {
      sandboxConfigRefreshing = false;
    });
}
// 注意：不在模块加载时立即刷新（vm→db→fixDB→utils→vm 存在循环依赖，顶层执行会触发 TDZ）；
// 首次 getSandboxConfig 时按需后台刷新，期间使用默认值（node:vm / 3000ms）
// 应用启动后（DB 就绪）调用 warmSandboxConfig() 预热，使配置从首个调用即生效
export function warmSandboxConfig(): void {
  refreshSandboxConfig();
}

function getSandboxConfig(): { engine: "node:vm" | "vm2"; timeout: number } {
  if (Date.now() - sandboxConfigLoadedAt > SANDBOX_CONFIG_TTL) refreshSandboxConfig(); // 过期则后台刷新，不阻塞执行
  return { engine: sandboxEngine, timeout: sandboxTimeout };
}

// ── 防原型链逃逸：阻断注入对象上的 constructor/__proto__/prototype 访问 ──
const BLOCKED_KEYS = new Set(["constructor", "__proto__", "prototype"]);
function harden(value: unknown): unknown {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) return value;
  return new Proxy(value as object, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && BLOCKED_KEYS.has(prop)) return undefined;
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, val) {
      if (typeof prop === "string" && BLOCKED_KEYS.has(prop)) return false;
      return Reflect.set(target, prop, val);
    },
  });
}

// ── node:vm 编译缓存（按代码内容哈希，容量 50，超出淘汰最旧）──
const scriptCache = new Map<string, vm.Script>();
const SCRIPT_CACHE_MAX = 50;
function getCachedScript(code: string): vm.Script {
  const hash = crypto.createHash("sha1").update(code).digest("hex");
  let script = scriptCache.get(hash);
  if (!script) {
    script = new vm.Script(code);
    scriptCache.set(hash, script);
    if (scriptCache.size > SCRIPT_CACHE_MAX) {
      const oldest = scriptCache.keys().next().value;
      if (oldest) scriptCache.delete(oldest);
    }
  }
  return script;
}

const MAX_CODE_LENGTH = 200_000;

export default function runCode(code: string, vendor?: Record<string, any>) {
  // 代码长度防护，避免超大脚本拖垮进程
  if (code.length > MAX_CODE_LENGTH) {
    throw new Error(`供应商脚本过长（>${MAX_CODE_LENGTH} 字符），已拒绝执行`);
  }
  code = code.replace(/export\s*\{\s*\};?/g, ""); // 去掉 export {} 以免沙盒环境报错
  // 创建一个沙盒
  const exports = {};
  const sandboxRaw: Record<string, any> = {
    createOpenAI,
    createDeepSeek,
    createZhipu,
    createQwen,
    createAnthropic,
    createOpenAICompatible,
    createXai,
    createMinimax,
    createGoogleGenerativeAI,
    zipImage,
    zipImageResolution,
    urlToBase64,
    mergeImages,
    pollTask,
    fetch: fetch,
    exports,
    axios: fetchAxios,
    FormData,
    logger,
    jsonwebtoken,
    crypto,
  };
  if (vendor !== undefined) {
    sandboxRaw.vendor = vendor;
  }

  const { engine, timeout } = getSandboxConfig();

  if (engine === "node:vm") {
    // 净化注入面：exports/vendor 为输出与数据，不做包裹；其余阻断原型链逃逸
    const context: Record<string, any> = {};
    for (const [key, value] of Object.entries(sandboxRaw)) {
      context[key] = key === "exports" || key === "vendor" ? value : harden(value);
    }
    getCachedScript(code).runInNewContext(context, { timeout });
  } else {
    // vm2 兼容引擎（可配置兜底）
    const sandbox: Record<string, any> = {};
    for (const [key, value] of Object.entries(sandboxRaw)) {
      sandbox[key] = key === "exports" || key === "vendor" ? value : harden(value);
    }
    const vm2 = new VM({
      timeout,
      sandbox,
      compiler: "javascript",
      eval: false,
      wasm: false,
    });
    vm2.run(code);
  }

  return exports as Record<string, any>;
}

// 基于 fetch 的 axios 兼容包装器，避免 Node.js http 模块在 https URL 上的协议错误
const fetchAxios = {
  async get(url: string, config?: any) {
    let targetUrl = url;
    if (config?.params) {
      const searchParams = new URLSearchParams(config.params);
      targetUrl = `${url}${url.includes("?") ? "&" : "?"}${searchParams.toString()}`;
    }
    const res = await fetch(targetUrl, { method: "GET", headers: config?.headers });
    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => { headers[key] = value; });
    let data: any;
    if (config?.responseType === "arraybuffer") {
      data = Buffer.from(await res.arrayBuffer());
    } else {
      const text = await res.text();
      try { data = JSON.parse(text); } catch { data = text; }
    }
    if (!res.ok) {
      const err = new Error(`Request failed with status code ${res.status}`);
      (err as any).response = { data, status: res.status, headers };
      throw err;
    }
    return { data, status: res.status, headers };
  },
  async post(url: string, body?: any, config?: any) {
    const headers: Record<string, string> = { ...config?.headers };
    let requestBody: any;
    // 处理 form-data 包
    if (body && typeof body.getHeaders === "function") {
      Object.assign(headers, body.getHeaders());
      requestBody = body.getBuffer();
    } else if (body && typeof body === "object") {
      if (!headers["Content-Type"] && !headers["content-type"]) {
        headers["Content-Type"] = "application/json";
      }
      requestBody = JSON.stringify(body);
    } else {
      requestBody = body;
    }
    const res = await fetch(url, { method: "POST", headers, body: requestBody });
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => { responseHeaders[key] = value; });
    let data: any;
    if (config?.responseType === "arraybuffer") {
      data = Buffer.from(await res.arrayBuffer());
    } else {
      const text = await res.text();
      try { data = JSON.parse(text); } catch { data = text; }
    }
    if (!res.ok) {
      const err = new Error(`Request failed with status code ${res.status}`);
      (err as any).response = { data, status: res.status, headers: responseHeaders };
      throw err;
    }
    return { data, status: res.status, headers: responseHeaders };
  },
};
export function logger(logstring: any) {
  console.log("【VM】" + JSON.stringify(logstring));
}
/**
 * 压缩图片，目标字节数不高于 size
 */
export async function zipImage(completeBase64: string, size: number): Promise<string> {
  let quality = 80;
  let buffer = Buffer.from(completeBase64.split(",")[1], "base64");
  let output = await sharp(buffer).jpeg({ quality }).toBuffer();
  while (output.length > size && quality > 10) {
    quality -= 10;
    output = await sharp(buffer).jpeg({ quality }).toBuffer();
  }
  return "data:image/jpeg;base64," + output.toString("base64");
}

export async function zipImageResolution(completeBase64: string, width: number, height: number): Promise<string> {
  const buffer = Buffer.from(completeBase64.split(",")[1], "base64");
  const out = await sharp(buffer).resize(width, height).toBuffer();
  return `data:image/jpeg;base64,${out.toString("base64")}`;
}

//url转Base64（带超时与状态校验，避免结果URL下载挂起导致任务一直“生成中”）
export async function urlToBase64(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`下载结果失败: HTTP ${res.status} ${url}`);
    const mime = res.headers.get("content-type") || "image/jpeg";
    const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
    return `data:${mime};base64,${b64}`;
  } catch (e: any) {
    if (e.name === "AbortError") throw new Error(`下载结果超时(120s): ${url}`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function pollTask(
  fn: () => Promise<{ completed: boolean; data?: string; error?: string }>,
  interval = 3000,
  timeout = 3000000,
): Promise<{ completed: boolean; data?: string; error?: string }> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const result = await fn();
      if (result.completed) return result;
      if (result?.error) return result;
    } catch (e: any) {
      return { completed: false, error: u.error(e).message || "poll error" };
    }
    await new Promise((res) => setTimeout(res, interval));
  }
  return { completed: false, error: "timeout" };
}

/**
 * 将多张图片横向拼接为一张，并确保输出大小不超过指定限制
 * @param imageBase64List - base64编码的图片数组
 * @param maxSize - 最大输出大小，支持格式如 "10mb", "5MB", "1024kb" 等
 * @returns 拼接后的图片base64字符串
 */
export async function mergeImages(imageBase64List: string[], maxSize = "10mb"): Promise<string> {
  if (imageBase64List.length === 0) {
    throw new Error("图片列表不能为空");
  }

  const maxBytes = parseSize(maxSize);
  const imageBuffers = imageBase64List.map(base64ToBuffer);
  const imageMetadatas = await Promise.all(imageBuffers.map((buffer) => sharp(buffer).metadata()));
  const maxHeight = Math.max(...imageMetadatas.map((m) => m.height || 0));

  // 计算各图片调整后的宽度
  const imageWidths = imageMetadatas.map((metadata) => {
    const aspectRatio = (metadata.width || 1) / (metadata.height || 1);
    return Math.round(maxHeight * aspectRatio);
  });
  const totalWidth = imageWidths.reduce((sum, w) => sum + w, 0);

  // 拼接图片
  const resizedImages = await Promise.all(
    imageBuffers.map(async (buffer, index) => {
      return sharp(buffer).resize(imageWidths[index], maxHeight, { fit: "cover" }).toBuffer();
    }),
  );

  let currentX = 0;
  const compositeInputs = resizedImages.map((buffer, index) => {
    const input = { input: buffer, left: currentX, top: 0 };
    currentX += imageWidths[index];
    return input;
  });

  const mergedBuffer = await sharp({
    create: {
      width: totalWidth,
      height: maxHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite(compositeInputs)
    .jpeg({ quality: 90 })
    .toBuffer();

  // 复用压缩逻辑
  const resultBuffer = await compressToSize(mergedBuffer, maxBytes, totalWidth, maxHeight);
  return resultBuffer.toString("base64");
}

/**
 * 解析大小字符串为字节数
 */
function parseSize(size: string): number {
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(kb|mb|gb|b)?$/);
  if (!match) {
    throw new Error(`无效的大小格式: ${size}`);
  }
  const value = parseFloat(match[1]);
  const unit = match[2] || "b";
  const multipliers: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };
  return Math.floor(value * multipliers[unit]);
}

/**
 * 将base64字符串转换为Buffer
 */
function base64ToBuffer(base64: string): Buffer {
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(base64Data, "base64");
}

/**
 * 压缩Buffer到指定大小以内
 */
async function compressToSize(imageBuffer: Buffer, maxBytes: number, originalWidth: number, originalHeight: number): Promise<Buffer> {
  let quality = 90;
  let scale = 1;

  while (true) {
    const targetWidth = Math.round(originalWidth * scale);
    const targetHeight = Math.round(originalHeight * scale);

    const resultBuffer = await sharp(imageBuffer).resize(targetWidth, targetHeight, { fit: "fill" }).jpeg({ quality }).toBuffer();

    if (resultBuffer.length <= maxBytes) {
      return resultBuffer;
    }

    if (quality > 10) {
      quality -= 10;
    } else {
      quality = 90;
      scale *= 0.8;
    }
  }
}
