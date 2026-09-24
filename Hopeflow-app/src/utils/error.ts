// utils/error.ts
import { serializeError } from "serialize-error";
import { isAxiosError } from "axios";

export interface NormalizedError {
  name: string;
  message: string;
  code?: string;
  status?: number;
  stack?: string;
  cause?: NormalizedError;
  responseData?: unknown;
  meta?: Record<string, unknown>;
}

/**
 * 从 axios 错误里挑出「最有信息量」的一句。
 *
 * 原实现只试了 `error.response.data.error.message || error.response.data.message || error.message`，
 * 于是当供应商返回形如 `{detail: "..."}` 或纯文本 body 时，
 * 用户和数据库里只会留下 `Request failed with status code 400` 这种零线索文案。
 * （现场确认：35 条分镜失败里有 20 条就是这个。）
 */
function pickAxiosMessage(error: any): string {
  const data = error?.response?.data;

  const candidates: unknown[] = [
    data?.error?.message,
    data?.message,
    data?.msg,
    data?.detail,
    data?.error_description,
    data?.error,
    typeof data === "string" ? data : undefined,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }

  // 结构化 body 直接序列化，宁可长一点也不要把线索丢干净
  if (data && typeof data === "object") {
    try {
      return JSON.stringify(data).slice(0, 500);
    } catch {
      /* 落到下面走 error.message */
    }
  }

  const status = error?.response?.status;
  const base = error?.message || "未知错误";
  // 没有 body 时至少把状态码讲清楚，别留一句裸的 Request failed
  if (status && /^Request failed with status code \d+$/.test(base)) {
    return `HTTP ${status}（供应商未返回错误详情）`;
  }
  return base;
}

export function normalizeError(error: unknown): NormalizedError {
  // Axios 特殊处理
  if (isAxiosError(error)) {
    return {
      name: "AxiosError",
      message: pickAxiosMessage(error),
      code: error.code,
      status: error.response?.status,
      stack: error.stack,
      responseData: error.response?.data,
      meta: {
        url: error.config?.url,
        method: error.config?.method,
      },
    };
  }

  // 普通 Error，用 serialize-error 处理
  if (error instanceof Error) {
    const serialized = serializeError(error);
    return {
      name: serialized.name || "Error",
      message: serialized.message || "未知错误",
      code: (serialized as any).code,
      stack: serialized.stack,
      cause: error.cause ? normalizeError(error.cause) : undefined,
      meta: extractMeta(serialized),
    };
  }

  // 非 Error
  return {
    name: "UnknownError",
    message: String(error),
    meta: { raw: serializeError(error) },
  };
}

// 提取自定义属性
function extractMeta(obj: Record<string, unknown>): Record<string, unknown> | undefined {
  const standardKeys = ["name", "message", "stack", "cause"];
  const meta: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (!standardKeys.includes(key) && value !== undefined) {
      meta[key] = value;
    }
  }

  return Object.keys(meta).length > 0 ? meta : undefined;
}

export default normalizeError;
