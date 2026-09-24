import { pipeline, env as transformersEnv, FeatureExtractionPipeline } from "@huggingface/transformers";
import path from "path";
import fs from "fs";
import getPath from "@/utils/getPath";
import db from "@/utils/db";

// ── 模型配置 ──
// const modelOnnxFile = ["all-MiniLM-L6-v2", "onnx", "model_fp16.onnx"]; // 模型文件路径
// const modelDtype = "fp16" as const; // 量化类型：fp32
let extractor: FeatureExtractionPipeline | null = null;
// 并发去重：多次并行调用 initEmbedding 时共享同一个加载 Promise，避免重复加载模型
let initPromise: Promise<void> | null = null;

export async function initEmbedding(): Promise<void> {
  if (extractor) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const modelConfigData = await db("o_setting").whereIn("key", ["modelOnnxFile", "modelDtype", "modelDevice"]);
    const modelObj: Record<string, string> = {};
    Object.entries(modelConfigData).forEach(([key, value]) => {
      modelObj[key] = value as string;
    });
    let modelOnnxFile = modelObj?.modelOnnxFile ? JSON.parse(modelObj.modelOnnxFile) : ["all-MiniLM-L6-v2", "onnx", "model_fp16.onnx"]; // 模型文件路径
    let modelDtype = modelObj?.modelDtype ?? ("fp16" as const); // 量化类型：fp32
    let modelDevice = modelObj?.modelDevice ?? "cpu"; // 推理设备：cpu | dml | auto
    const onnxPath = path.join(getPath("models"), ...modelOnnxFile);
    if (!fs.existsSync(onnxPath)) {
      throw new Error(`Embedding 模型文件不存在: ${onnxPath}`);
    }

    transformersEnv.allowRemoteModels = false;
    transformersEnv.allowLocalModels = true;
    transformersEnv.localModelPath = getPath("models").replace(/\\/g, "/") + "/";

    const modelFolder = modelOnnxFile[0];
    const createExtractor = async (device: string): Promise<FeatureExtractionPipeline> => {
      // @ts-ignore - pipeline 重载联合类型过于复杂
      return await pipeline("feature-extraction", modelFolder, { dtype: modelDtype, device });
    };

    if (modelDevice === "cpu") {
      extractor = await createExtractor("cpu");
    } else {
      // dml / auto：优先使用 DirectML（Windows GPU）加速，初始化失败自动回退 CPU
      try {
        extractor = await createExtractor("dml");
        console.log("[Embedding] 已启用 DirectML GPU 加速");
      } catch (e) {
        console.warn("[Embedding] DirectML 初始化失败，已回退 CPU:", (e as Error)?.message);
        extractor = await createExtractor("cpu");
      }
    }
  })().finally(() => {
    // 无论成败都释放锁：成功后走 extractor 短路，失败后允许下次重试
    initPromise = null;
  });

  return initPromise;
}

export async function getEmbedding(text: string): Promise<number[]> {
  if (!extractor) await initEmbedding();
  const output = await extractor!(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  return a.reduce((dot, v, i) => dot + v * b[i], 0);
}

export async function disposeEmbedding(): Promise<void> {
  await extractor?.dispose?.();
  extractor = null;
}
