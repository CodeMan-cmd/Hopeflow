import u from "@/utils";

const DAY_MS = 86400000;
const TREND_DAYS = 14;

export interface DashboardStats {
  overview: { total: number; running: number; success: number; failed: number; successRate: number };
  modelStats: { model: string; count: number; success: number; failed: number; successRate: number }[];
  trend: { date: string; total: number; success: number; failed: number }[];
  failReasons: { reason: string; count: number }[];
}

// 聚合任务数据：概览 / 模型用量 TOP10 / 近14天趋势 / 失败归因 TOP8
export async function collectStats(): Promise<DashboardStats> {
  // ── 状态分布 ──
  const stateRows = await u.db("o_tasks").select("state").count({ count: "*" }).groupBy("state");
  const stateMap: Record<string, number> = {};
  stateRows.forEach((r: any) => {
    stateMap[r.state ?? "未知"] = Number(r.count);
  });
  const running = stateMap["进行中"] ?? 0;
  const successCount = stateMap["已完成"] ?? 0;
  const failed = stateMap["生成失败"] ?? 0;
  const total = running + successCount + failed;
  const successRate = total > 0 ? Number(((successCount / total) * 100).toFixed(1)) : 0;

  // ── 模型用量统计 ──
  const modelRows = await u.db("o_tasks").select("model", "state").whereNotNull("model");
  const modelMap = new Map<string, { count: number; success: number; failed: number }>();
  modelRows.forEach((r: any) => {
    const key = r.model || "未知模型";
    const item = modelMap.get(key) ?? { count: 0, success: 0, failed: 0 };
    item.count += 1;
    if (r.state === "已完成") item.success += 1;
    if (r.state === "生成失败") item.failed += 1;
    modelMap.set(key, item);
  });
  const modelStats = Array.from(modelMap.entries())
    .map(([model, v]) => ({
      model,
      count: v.count,
      success: v.success,
      failed: v.failed,
      successRate: v.count > 0 ? Number(((v.success / v.count) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // ── 失败归因 TOP ──
  const failRows = await u.db("o_tasks").select("reason").count({ count: "*" }).where("state", "生成失败").whereNotNull("reason").groupBy("reason");
  const failReasons = failRows
    .map((r: any) => ({ reason: (r.reason || "未知原因").slice(0, 60), count: Number(r.count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // ── 近 14 天生成趋势（按天聚合） ──
  const start = Date.now() - (TREND_DAYS - 1) * DAY_MS;
  const trendRows = await u.db("o_tasks").select("startTime", "state").where("startTime", ">=", start);
  const dayBuckets: Record<string, { total: number; success: number; failed: number }> = {};
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY_MS);
    dayBuckets[`${d.getMonth() + 1}-${String(d.getDate()).padStart(2, "0")}`] = { total: 0, success: 0, failed: 0 };
  }
  trendRows.forEach((r: any) => {
    const d = new Date(Number(r.startTime) || 0);
    if (Number.isNaN(d.getTime())) return;
    const key = `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, "0")}`;
    const bucket = dayBuckets[key];
    if (!bucket) return;
    bucket.total += 1;
    if (r.state === "已完成") bucket.success += 1;
    if (r.state === "生成失败") bucket.failed += 1;
  });
  const trend = Object.entries(dayBuckets).map(([date, v]) => ({ date, ...v }));

  return { overview: { total, running, success: successCount, failed, successRate }, modelStats, trend, failReasons };
}
