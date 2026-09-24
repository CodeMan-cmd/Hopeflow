import express from "express";
import u from "@/utils";
import { z } from "zod";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { tool, jsonSchema } from "ai";
import { o_script } from "@/types/database";
import { getEmbedding } from "@/utils/agent/embedding";

const router = express.Router();

/** 知识库设定条目 */
const KnowledgeItemSchema = z.object({
  type: z.enum(["world", "character", "term", "other"]).describe("设定分类：world世界观 / character人物 / term术语 / other其他"),
  title: z.string().describe("设定标题，简洁名词短语"),
  content: z.string().describe("设定内容，30-200字客观陈述"),
});

type KnowledgeItem = z.infer<typeof KnowledgeItemSchema>;

/** 将 scriptIds 按 groupSize 分组 */
function chunkArray(arr: number[], groupSize: number): number[][] {
  const chunks: number[][] = [];
  for (let i = 0; i < arr.length; i += groupSize) {
    chunks.push(arr.slice(i, i + groupSize));
  }
  return chunks;
}

export default router.post(
  "/",
  validateFields({
    scriptIds: z.array(z.number()),
    projectId: z.number(),
    groupSize: z.number().min(1).optional(),
  }),
  async (req, res) => {
    const { scriptIds, projectId, groupSize = 5 } = req.body;

    if (!scriptIds.length) return res.status(400).send(error("请先选择剧本"));
    const scripts = await u.db("o_script").whereIn("id", scriptIds).where("projectId", projectId);
    const scriptMap = new Map(scripts.map((s: o_script) => [s.id, s]));

    // 先标记为等待提取，前端剧本卡片可即时展示等待提示
    await u.db("o_script").whereIn("id", scriptIds).update({
      knowledgeState: 2,
      knowledgeErrorReason: null,
    });

    res.send(success("开始提取知识库设定"));

    const scriptGroups = chunkArray(scriptIds as number[], groupSize);

    scriptGroups.map(async (groupIds) => {
      const validScripts: { id: number; script: o_script }[] = [];
      for (const scriptId of groupIds) {
        const script = scriptMap.get(scriptId);
        if (script) validScripts.push({ id: scriptId, script });
      }
      if (!validScripts.length) return;
      const validScriptIds = validScripts.map((v) => v.id);

      // 标记为正在提取
      await u.db("o_script").where("projectId", projectId).whereIn("id", validScriptIds).update({
        knowledgeState: 0,
      });

      const scriptsContent = validScripts
        .map(({ id, script }) => `===== 【剧本ID: ${id}】${script.name || ""} =====\n${script.content}`)
        .join("\n\n");

      let collected: KnowledgeItem[] = [];
      try {
        const resultTool = tool({
          description: "返回结果时必须调用这个工具",
          inputSchema: jsonSchema<{ items: KnowledgeItem[] }>(
            z
              .object({
                items: z.array(KnowledgeItemSchema).describe("从剧本中提取的设定条目列表"),
              })
              .toJSONSchema(),
          ),
          execute: async ({ items }) => {
            if (items?.length) collected = items;
            return "无需回复用户任何内容";
          },
        });
        const promptData = await u.db("o_prompt").where("type", "knowledgeExtraction").first();
        let knowledgeExtraction = "" as string | undefined;
        if (promptData && promptData.useData) {
          knowledgeExtraction = promptData.useData;
        } else {
          knowledgeExtraction = promptData?.data ?? undefined;
        }
        await u.Ai.Text("universalAi").invoke({
          system:
            knowledgeExtraction +
            "\n\n注意：本次会同时提供多集剧本，每集剧本以 ===== 【剧本ID: xxx】 ===== 分隔。跨集合并相同设定，结果必须通过 resultTool 工具返回。",
          messages: [
            {
              role: "user",
              content: `请根据以下${validScripts.length}集剧本提取世界观、人物、术语、其他设定：\n\n${scriptsContent}`,
            },
          ],
          tools: { resultTool },
        });

        if (!collected.length) {
          // AI 未返回任何设定，标记为失败
          await u.db("o_script").where("projectId", projectId).whereIn("id", validScriptIds).update({
            knowledgeState: -1,
            knowledgeErrorReason: "AI 未返回任何设定",
          });
          return;
        }

        // 写入知识库：同项目+分类+标题已存在的条目不重复插入，直接覆盖内容
        const rows = await u.db("o_knowledge").where("projectId", projectId).select("id", "type", "title");
        const existingMap = new Map(rows.map((r) => [`${r.type}_${r.title}`, r.id]));
        const now = Date.now();
        const toInsert: { projectId: number; type: string; title: string; content: string; embedding: string; updatedAt: number }[] = [];
        const toUpdate: { id: number; content: string; embedding: string; updatedAt: number }[] = [];

        for (const item of collected) {
          if (!item.title?.trim() || !item.content?.trim()) continue;
          const key = `${item.type}_${item.title.trim()}`;
          const embedding = JSON.stringify(await getEmbedding(`${item.title.trim()}\n${item.content.trim()}`));
          const existingId = existingMap.get(key);
          if (existingId) {
            toUpdate.push({ id: existingId, content: item.content.trim(), embedding, updatedAt: now });
          } else {
            toInsert.push({
              projectId,
              type: item.type,
              title: item.title.trim(),
              content: item.content.trim(),
              embedding,
              updatedAt: now,
            });
            existingMap.set(key, -1); // 同批去重
          }
        }

        for (const upd of toUpdate) {
          await u.db("o_knowledge").where("id", upd.id).update(upd);
        }
        if (toInsert.length) {
          await u.db("o_knowledge").insert(toInsert);
        }
        console.log(`[extractKnowledge] 剧本 [${validScriptIds.join(",")}] 提取知识库设定完成：新增 ${toInsert.length} 条，更新 ${toUpdate.length} 条`);
        // 标记为提取成功
        await u.db("o_script").where("projectId", projectId).whereIn("id", validScriptIds).update({
          knowledgeState: 1,
          knowledgeErrorReason: null,
        });
      } catch (e) {
        console.error(`[extractKnowledge] group=[${validScriptIds.join(",")}] 提取失败:`, e);
        // 标记为提取失败
        await u.db("o_script").where("projectId", projectId).whereIn("id", validScriptIds).update({
          knowledgeState: -1,
          knowledgeErrorReason: u.error(e).message,
        });
      }
    });
  },
);
