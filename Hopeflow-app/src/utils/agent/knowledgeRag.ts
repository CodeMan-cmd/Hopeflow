import u from "@/utils";
import { getEmbedding, cosineSimilarity } from "@/utils/agent/embedding";

const TYPE_LABELS: Record<string, string> = { world: "世界观", character: "人物", term: "术语", other: "其他" };

/** 短时缓存：同一项目在较短时间内多次注入复用同一结果，避免重复检索 */
const cache = new Map<number, { time: number; result: string }>();
const CACHE_TTL = 60 * 1000;

/**
 * 检索项目知识库中与 query 语义最相关的设定条目，格式化为 Agent 上下文。
 * 项目无知识库数据时返回空字符串（调用方不注入）。
 * embedding 为空的旧数据在检索时惰性回填。
 */
export async function getKnowledgeContext(projectId: number, query: string, limit = 5): Promise<string> {
  const cached = cache.get(projectId);
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.result;

  const list = await u.db("o_knowledge").where("projectId", projectId).select("id", "type", "title", "content", "embedding");
  if (!list.length) {
    cache.set(projectId, { time: Date.now(), result: "" });
    return "";
  }

  // 惰性回填：老数据没有向量时现场计算并写回
  const needEmbedding = list.filter((k) => !k.embedding);
  for (const k of needEmbedding) {
    try {
      const title = k.title ?? "";
      const content = k.content ?? "";
      const emb = await getEmbedding(`${title}\n${content}`);
      await u.db("o_knowledge").where("id", k.id).update({ embedding: JSON.stringify(emb) });
      k.embedding = JSON.stringify(emb);
    } catch (e) {
      console.warn("[knowledgeRag] 向量回填失败:", u.error(e).message);
    }
  }

  const withEmbedding = list.filter((k) => k.embedding);
  if (!withEmbedding.length) {
    cache.set(projectId, { time: Date.now(), result: "" });
    return "";
  }

  const queryEmbedding = await getEmbedding(query);
  const top = withEmbedding
    .map((k) => ({ ...k, similarity: cosineSimilarity(queryEmbedding, JSON.parse(k.embedding!)) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  const text = top
    .map((k) => `【${TYPE_LABELS[k.type ?? "other"] ?? k.type}】${k.title ?? ""}\n${k.content ?? ""}`)
    .join("\n\n");
  const result = text ? `## 项目知识库\n${text}` : "";
  cache.set(projectId, { time: Date.now(), result });
  return result;
}
