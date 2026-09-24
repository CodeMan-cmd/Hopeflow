import express from "express";
import u from "@/utils";
import { success, error } from "@/lib/responseFormat";
import { z } from "zod";
import { validateFields } from "@/middleware/middleware";
import { getEmbedding } from "@/utils/agent/embedding";
const router = express.Router();

const TYPE_LABELS: Record<string, string> = { world: "世界观", character: "人物", term: "术语", other: "其他" };

/** 计算设定条目的向量（供 Agent 语义检索注入） */
async function embedContent(title: string, content: string): Promise<string> {
  try {
    return JSON.stringify(await getEmbedding(`${title}\n${content}`));
  } catch (e) {
    console.warn("[knowledge] embedding 计算失败:", u.error(e).message);
    return "";
  }
}

// 设定列表（按项目）
router.get(
  "/list",
  validateFields(
    {
      projectId: z.coerce.number().int().optional(),
    },
    "query",
  ),
  async (req, res) => {
    const projectId = req.query.projectId ? Number(req.query.projectId) : null;
    let query = u.db("o_knowledge").select("*");
    if (projectId) query = query.where("projectId", projectId);
    const list = await query.orderBy("updatedAt", "desc");
    res.status(200).send(success(list));
  },
);

// 新增设定
router.post(
  "/add",
  validateFields({
    projectId: z.number().int(),
    type: z.enum(["world", "character", "term", "other"]),
    title: z.string().min(1, "标题不能为空"),
    content: z.string().min(1, "内容不能为空"),
  }),
  async (req, res) => {
    const { projectId, type, title, content } = req.body;
    const [id] = await u.db("o_knowledge").insert({
      projectId,
      type,
      title,
      content,
      embedding: await embedContent(title, content),
      updatedAt: Date.now(),
    });
    res.status(200).send(success({ id }));
  },
);

// 更新设定
router.post(
  "/update",
  validateFields({
    id: z.number().int().positive(),
  }),
  async (req, res) => {
    const { id } = req.body;
    const exists = await u.db("o_knowledge").where("id", id).first();
    if (!exists) return res.status(400).send(error("设定不存在"));
    const patch: Record<string, any> = { updatedAt: Date.now() };
    ["projectId", "type", "title", "content"].forEach((f) => {
      if (req.body[f] !== undefined) patch[f] = req.body[f];
    });
    // 标题或内容变更时同步更新向量
    if (req.body.title !== undefined || req.body.content !== undefined) {
      patch.embedding = await embedContent(req.body.title ?? exists.title, req.body.content ?? exists.content);
    }
    await u.db("o_knowledge").where("id", id).update(patch);
    res.status(200).send(success("更新成功"));
  },
);

// 删除设定
router.post(
  "/delete",
  validateFields({
    id: z.number().int().positive(),
  }),
  async (req, res) => {
    const { id } = req.body;
    await u.db("o_knowledge").where("id", id).del();
    res.status(200).send(success("删除成功"));
  },
);

// 批量导入设定（同项目同类型同标题自动去重，避免往返导入产生冗余）
router.post(
  "/import",
  validateFields({
    projectId: z.number().int(),
    items: z
      .array(
        z.object({
          type: z.enum(["world", "character", "term", "other"]),
          title: z.string().min(1, "标题不能为空"),
          content: z.string().min(1, "内容不能为空"),
        }),
      )
      .min(1, "没有可导入的内容")
      .max(500, "单次导入最多 500 条"),
  }),
  async (req, res) => {
    const { projectId, items } = req.body;
    // 查询该项目已有 (type + title) 组合用于去重
    const existing = await u.db("o_knowledge").where("projectId", projectId).select("type", "title");
    const existsKey = new Set(existing.map((k: any) => `${k.type}|${k.title}`));
    const fresh = items.filter((k: any) => !existsKey.has(`${k.type}|${k.title}`));
    if (fresh.length > 0) {
      const rows = await Promise.all(
        fresh.map(async (k: any) => ({
          projectId,
          type: k.type,
          title: k.title,
          content: k.content,
          embedding: await embedContent(k.title, k.content),
          updatedAt: Date.now(),
        })),
      );
      await u.db("o_knowledge").insert(rows);
    }
    res.status(200).send(success({ imported: fresh.length, skipped: items.length - fresh.length }));
  },
);

// 导出全部设定为文本（供 agent 生成时注入 / 用户预览）
router.get(
  "/export",
  validateFields(
    {
      projectId: z.coerce.number().int().optional(),
    },
    "query",
  ),
  async (req, res) => {
    const projectId = req.query.projectId ? Number(req.query.projectId) : null;
    let query = u.db("o_knowledge").select("*");
    if (projectId) query = query.where("projectId", projectId);
    const list = await query.orderBy("updatedAt", "desc");
    const text = list
      .map((k: any) => `【${TYPE_LABELS[k.type] ?? k.type}】${k.title}\n${k.content}`)
      .join("\n\n");
    res.status(200).send(success(text));
  },
);

export default router;
