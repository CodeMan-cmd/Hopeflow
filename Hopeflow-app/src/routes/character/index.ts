import express from "express";
import u from "@/utils";
import { success, error } from "@/lib/responseFormat";
import { z } from "zod";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

const CHAR_FIELDS = ["name", "gender", "personality", "appearance", "background", "relations", "voiceDesc"] as const;

// 角色列表
router.get(
  "/list",
  validateFields(
    {
      keyword: z.string().optional(),
    },
    "query",
  ),
  async (req, res) => {
    const { keyword } = req.query as { keyword?: string };
    let query = u.db("o_character").select("*");
    if (keyword && String(keyword).trim()) {
      const kw = `%${String(keyword).trim()}%`;
      query = query.where("name", "like", kw).orWhere("personality", "like", kw);
    }
    const list = await query.orderBy("updatedAt", "desc");
    res.status(200).send(success(list));
  },
);

// 新增角色
router.post(
  "/add",
  validateFields({
    name: z.string().min(1, "角色名不能为空"),
    gender: z.string().optional(),
    personality: z.string().optional(),
    appearance: z.string().optional(),
    background: z.string().optional(),
    relations: z.string().optional(),
    voiceDesc: z.string().optional(),
  }),
  async (req, res) => {
    const body = req.body;
    const now = Date.now();
    const [id] = await u.db("o_character").insert({
      name: body.name,
      gender: body.gender ?? "",
      personality: body.personality ?? "",
      appearance: body.appearance ?? "",
      background: body.background ?? "",
      relations: body.relations ?? "",
      voiceDesc: body.voiceDesc ?? "",
      createdAt: now,
      updatedAt: now,
    });
    res.status(200).send(success({ id }));
  },
);

// 更新角色
router.post(
  "/update",
  validateFields({
    id: z.number().int().positive(),
  }),
  async (req, res) => {
    const { id } = req.body;
    const exists = await u.db("o_character").where("id", id).first();
    if (!exists) return res.status(400).send(error("角色不存在"));
    const patch: Record<string, any> = { updatedAt: Date.now() };
    CHAR_FIELDS.forEach((f) => {
      if (req.body[f] !== undefined) patch[f] = req.body[f];
    });
    await u.db("o_character").where("id", id).update(patch);
    res.status(200).send(success("更新成功"));
  },
);

// 删除角色
router.post(
  "/delete",
  validateFields({
    id: z.number().int().positive(),
  }),
  async (req, res) => {
    const { id } = req.body;
    await u.db("o_character").where("id", id).del();
    res.status(200).send(success("删除成功"));
  },
);

// ────────────── AI 能力 ──────────────

const CHAR_KEYS = ["gender", "personality", "appearance", "background", "relations", "voiceDesc"] as const;

// 解析 AI 输出的 JSON（容错 ```json 包裹），同 generateSkill.ts 模式
function parseJsonOutput(text: string): Record<string, any> {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) throw new Error("AI 输出未包含有效的 JSON 对象");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function parseJsonArray(text: string): any[] {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end < 0 || end <= start) throw new Error("AI 输出未包含有效的 JSON 数组");
  const arr = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(arr)) throw new Error("AI 输出不是数组");
  return arr;
}

// 角色设定输出的统一约束（供 system prompt 使用）
const SETTING_RULES = `请输出 JSON，字段如下（性格/外貌/背景各 60-150 字，关系与音色描述 30-80 字）：
- gender: "男" | "女" | "其他"
- personality: 性格
- appearance: 外貌
- background: 背景
- relations: 关系
- voiceDesc: 音色描述`;

// AI 生成角色：描述 → 完整设定（不自动入库，前端预览确认后调 /add）
router.post(
  "/aiGenerate",
  validateFields({
    name: z.string().min(1, "角色名不能为空"),
    description: z.string().min(1, "描述不能为空"),
    model: z.string().min(1, "请选择文本模型"),
  }),
  async (req, res) => {
    try {
      const { name, description, model } = req.body;
      const system = `你是一名专业的短剧角色设定师。根据用户给出的角色名和一句话描述，创作一份完整的角色设定。${SETTING_RULES}`;
      const ai = await u.Ai.Text(model as `${string}:${string}`).invoke({
        system,
        messages: [{ role: "user", content: `角色名：${name}\n描述：${description}` }],
      });
      const parsed = parseJsonOutput(ai.text);
      const result: Record<string, any> = { name };
      CHAR_KEYS.forEach((k) => (result[k] = String(parsed[k] ?? "")));
      res.status(200).send(success(result));
    } catch (e: any) {
      res.status(500).send(error(e?.message || "AI 生成角色失败"));
    }
  },
);

// AI 优化角色：基于现有设定扩写润色（不自动入库，前端确认后调 /update）
router.post(
  "/aiOptimize",
  validateFields({
    id: z.number().int().positive(),
    model: z.string().min(1, "请选择文本模型"),
    focus: z.string().optional(),
  }),
  async (req, res) => {
    try {
      const { id, model, focus } = req.body;
      const exists = await u.db("o_character").where("id", id).first();
      if (!exists) return res.status(400).send(error("角色不存在"));
      const current = `${CHAR_KEYS.map((k) => `${k}: ${exists[k] || "（未填写）"}`).join("\n")}`;
      const system = `你是一名专业的短剧角色设定师。用户会给你一个角色的现有设定，请在保留原有设定的基础上扩写润色，使内容更丰满、更有层次。${SETTING_RULES}${
        focus ? `\n请重点围绕「${focus}」进行深化。` : ""
      }`;
      const ai = await u.Ai.Text(model as `${string}:${string}`).invoke({
        system,
        messages: [{ role: "user", content: `角色名：${exists.name}\n现有设定：\n${current}` }],
      });
      const parsed = parseJsonOutput(ai.text);
      const result: Record<string, any> = { id, name: exists.name };
      CHAR_KEYS.forEach((k) => (result[k] = String(parsed[k] ?? exists[k] ?? "")));
      res.status(200).send(success(result));
    } catch (e: any) {
      res.status(500).send(error(e?.message || "AI 优化角色失败"));
    }
  },
);

// 从小说/剧本提取候选角色（不自动入库，前端勾选后批量调 /add）
router.post(
  "/aiExtract",
  validateFields({
    projectId: z.number().int().positive(),
    model: z.string().min(1, "请选择文本模型"),
    source: z.enum(["novel", "script"]),
  }),
  async (req, res) => {
    try {
      const { projectId, model, source } = req.body;

      // 读取原文并截断，控制 token 成本
      const MAX_CHUNKS = 10;
      const MAX_CHUNK_LEN = 2000;
      let text = "";
      if (source === "script") {
        const rows = await u.db("o_script").select("content").where("projectId", projectId).orderBy("sort", "asc").limit(MAX_CHUNKS);
        text = rows.map((r: any) => r.content || "").join("\n");
      } else {
        const rows = await u.db("o_novel").select("chapterData").where("projectId", projectId).orderBy("chapterIndex", "asc").limit(MAX_CHUNKS);
        text = rows
          .map((r: any) => {
            const raw = r.chapterData || "";
            try {
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed === "object") return parsed.text ?? parsed.content ?? "";
              return raw;
            } catch {
              return raw;
            }
          })
          .join("\n");
      }
      const truncated = text
        .split("\n")
        .map((s) => s.slice(0, MAX_CHUNK_LEN))
        .filter(Boolean)
        .slice(0, MAX_CHUNKS)
        .join("\n");
      if (!truncated) return res.status(400).send(error("该来源暂无内容可提取"));

      const system = `你是一名专业的短剧角色设定师。用户会给你一段小说/剧本文本，请识别其中所有有名字、有戏份的角色，输出角色数组 JSON。数组元素结构：{ name, gender, personality, appearance, background, relations, voiceDesc }。要求：
- 只提取真实出场且有名字的角色，忽略路人
- 性格/外貌/背景各 60-150 字，关系与音色描述 30-80 字；原文未提及的字段填合理推测
- 只输出 JSON 数组，不要任何解释文字`;
      const ai = await u.Ai.Text(model as `${string}:${string}`).invoke({
        system,
        messages: [{ role: "user", content: truncated }],
      });
      const arr = parseJsonArray(ai.text);
      const list = arr
        .filter((item: any) => item && item.name)
        .map((item: any) => {
          const result: Record<string, any> = { name: String(item.name).trim() };
          CHAR_KEYS.forEach((k) => (result[k] = String(item[k] ?? "")));
          return result;
        });
      if (!list.length) return res.status(200).send(success([]));
      res.status(200).send(success(list));
    } catch (e: any) {
      res.status(500).send(error(e?.message || "AI 提取角色失败"));
    }
  },
);

export default router;
