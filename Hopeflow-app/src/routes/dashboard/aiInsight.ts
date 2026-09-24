import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { collectStats } from "@/utils/statsCore";
const router = express.Router();

// AI 洞察报告：将任务统计数据交给文本模型，产出 Markdown 分析报告并保存到历史表
router.post(
  "/",
  validateFields({
    model: z.string().min(1, "请选择文本模型"),
  }),
  async (req, res) => {
    try {
      const { model } = req.body;
      const stats = await collectStats();

      const system = `你是一名专业的短剧生产数据分析师。用户会给你一组 AI 生成任务的统计数据（JSON），请输出一份 Markdown 格式的中文分析报告，包含以下小节：
1. 总体概览：任务总量、成功率，一句话评价整体健康度
2. 模型用量与成功率：表现最好与最差的模型，指出差距
3. 趋势解读：近 14 天的走势，是否有明显上升/下降或波动
4. 失败归因分析：按失败原因出现的频次解读主要问题
5. 优化建议：给出 2-4 条具体可执行的改进建议

要求：
- 使用 Markdown 标题、列表、加粗等格式，结构清晰
- 数据不足或为零时，如实说明"暂无足够数据"，不要编造数字
- 所有数据必须基于用户提供的 JSON，不得虚构`;

      const resAi = await u.Ai.Text(model as `${string}:${string}`).invoke({
        system,
        messages: [{ role: "user", content: `统计数据如下：\n${JSON.stringify(stats, null, 2)}` }],
      });
      const report = resAi.text?.trim();
      if (!report) throw new Error("AI 未返回内容");

      // 持久化保存报告与统计数据快照
      const createTime = Date.now();
      const [id] = await u.db("o_aiInsightReport").insert({
        model,
        report,
        statsSnapshot: JSON.stringify(stats),
        createTime,
      });
      res.status(200).send(success({ id, model, report, createTime }));
    } catch (e: any) {
      res.status(500).send(error(e?.message || "AI 洞察生成失败"));
    }
  },
);

// 历史记录列表（不含报告全文，倒序，最多 50 条）
router.get("/history", async (req, res) => {
  try {
    const list = await u
      .db("o_aiInsightReport")
      .select("id", "model", "createTime")
      .orderBy("createTime", "desc")
      .limit(50);
    res.status(200).send(success(list));
  } catch (e: any) {
    res.status(500).send(error(e?.message || "获取历史记录失败"));
  }
});

// 历史记录详情（含报告全文）
router.get("/history/:id", async (req, res) => {
  try {
    const row = await u.db("o_aiInsightReport").where({ id: Number(req.params.id) }).first();
    if (!row) {
      res.status(404).send(error("记录不存在"));
      return;
    }
    res.status(200).send(success(row));
  } catch (e: any) {
    res.status(500).send(error(e?.message || "获取报告失败"));
  }
});

// 删除历史记录
router.delete("/history/:id", async (req, res) => {
  try {
    await u.db("o_aiInsightReport").where({ id: Number(req.params.id) }).del();
    res.status(200).send(success(null, "已删除"));
  } catch (e: any) {
    res.status(500).send(error(e?.message || "删除失败"));
  }
});

export default router;
