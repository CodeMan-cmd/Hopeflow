import express from "express";
import pLimit from "p-limit";
import u from "@/utils";
import { z } from "zod";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

// 智能生成角色音色描述（voice_prompt）：根据角色名称与设定，用 LLM 生成中文音色描述
// 供「文生音色（DashScope Voice Design）」模式使用，生成后用户可手动编辑
export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    roleIds: z.array(z.number()),
    concurrentCount: z.number().min(1).optional(),
  }),
  async (req, res) => {
    const { projectId, roleIds, concurrentCount } = req.body;

    const roles = (await u
      .db("o_assets")
      .whereIn("id", roleIds)
      .andWhere("projectId", projectId)
      .andWhere("type", "role")
      .select("id", "name", "describe")) as { id: number; name: string; describe?: string | null }[];
    if (roles.length === 0) return res.status(400).send(error("所选角色不存在"));

    const result: Record<string, string> = {};
    const limit = pLimit(concurrentCount ?? 3);

    await Promise.all(
      roles.map((role) =>
        limit(async () => {
          const { text } = await u.Ai.Text("universalAi").invoke({
            system:
              "你是一位专业的配音导演与音色设计师。根据角色的名称和人物设定，为 AI 短剧中的该角色设计一段中文音色描述（voice_prompt），用于通过 AI 语音模型生成该角色的专属音色。\n" +
              "要求：\n" +
              "1. 用简洁、具象的中文描述声音质感，如「清冷少年音」「成熟慵懒男性，低沉磁性，语速舒缓」「娇俏甜美的少女音，尾音上扬」\n" +
              "2. 涵盖音色特征（性别年龄段/音色质感）、语速、情绪基调，并贴合角色的性格、身份与年龄\n" +
              "3. 输出 1-2 句话即可，直接输出音色描述本身，不要任何前缀、引号或多余内容",
            messages: [
              {
                role: "user",
                content: `角色名称：${role.name}\n角色描述：${role.describe ?? "无"}`,
              },
            ],
          });
          result[String(role.id)] = (text ?? "").trim();
        }),
      ),
    );

    res.status(200).send(success(result));
  },
);
