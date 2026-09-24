import express from "express";
import u from "@/utils";
import pLimit from "p-limit";
import * as zod from "zod";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { classifyError } from "@/utils/errorClassify";
import { artStyleExists } from "@/utils/projectConfig";
const router = express.Router();
interface OutlineItem {
  description: string;
  name: string;
}

interface OutlineData {
  chapterRange: number[];
  characters?: OutlineItem[];
  props?: OutlineItem[];
  scenes?: OutlineItem[];
}

interface NovelChapter {
  id: number;
  reel: string;
  chapter: string;
  chapterData: string;
  projectId: number;
}

type ItemType = "characters" | "props" | "scenes";

//润色提示词
export default router.post(
  "/",
  validateFields({
    items: zod.array(
      zod.object({
        assetsId: zod.number(),
        type: zod.string(),
        name: zod.string(),
        describe: zod.string(),
      }),
    ),
    projectId: zod.number(),
    concurrentCount: zod.number().int().min(1).optional(),
    otherTextPrompt: zod.string().optional().default(""),
  }),
  async (req, res) => {
    const { projectId, items, concurrentCount, otherTextPrompt } = req.body;
    //获取风格
    const project = await u.db("o_project").where("id", projectId).select("artStyle", "type", "intro").first();
    //如果没有找到对应的项目，返回错误
    if (!project) return res.status(400).send(error("项目为空"));

    // 整批门禁：画风解析不到内置视觉手册时，逐个资产都会失败成「视觉手册未定义」，
    // 与其落 8 条一模一样的错误，不如一次性说清楚并让用户去选画风。
    if (!artStyleExists(project.artStyle as string)) {
      return res.status(400).send({
        message: `项目画风「${project.artStyle ?? ""}」没有解析到内置视觉手册，提示词会整批生成失败。请先到项目配置里重新选择画风。`,
        errorType: "config",
        code: "ART_STYLE_UNRESOLVED",
      });
    }

    // 查询项目全部非衍生资产（角色/场景/道具），构建全局资产设定上下文
    const projectAssets = await u
      .db("o_assets")
      .where("projectId", projectId)
      .where("assetsId", null)
      .whereIn("type", ["role", "scene", "tool"])
      .select("type", "name", "describe");
    const typeLabels: Record<string, string> = { role: "角色", scene: "场景", tool: "道具" };
    const contextBlocks: string[] = [];
    // 项目简介已由前端预填到 otherTextPrompt 时，避免重复注入
    if (project.intro && !otherTextPrompt.includes(project.intro)) contextBlocks.push(`故事简介：${project.intro}`);
    (["role", "scene", "tool"] as const).forEach((t) => {
      const list = projectAssets
        .filter((a: any) => a.type === t && a.describe)
        .map((a: any) => `- ${a.name}：${a.describe}`);
      if (list.length) contextBlocks.push(`${typeLabels[t]}：\n${list.join("\n")}`);
    });
    const projectContext = contextBlocks.length
      ? `\n\n## 项目设定（供参考，确保提示词与项目整体设定一致）\n${contextBlocks.join("\n\n")}`
      : "";

    // 预加载公共数据
    const assetsIds = items.map((item: { assetsId: number }) => item.assetsId);
    //查询所有资产，用于判断每个资产是否是衍生资产
    const assetsDataList = await u.db("o_assets").whereIn("id", assetsIds).select("id", "assetsId");
    if (!assetsDataList || assetsDataList.length === 0) return res.status(400).send(error("资产不存在"));
    const assetsDataMap = new Map(assetsDataList.map((a: any) => [a.id, a]));
    // 所有前置检测通过后，再批量更新状态为生成中
    await u.db("o_assets").whereIn("id", assetsIds).update({ promptState: "生成中" });

    const getTypeConfig = (
      isDerivative: boolean,
    ): Record<string, { promptKey: string; itemType: ItemType; label: string; nameLabel: string; visualManual: string }> => ({
      role: {
        promptKey: "role-polish",
        itemType: "characters",
        label: "角色标准四视图",
        nameLabel: "角色",
        visualManual: isDerivative ? "art_character_derivative" : "art_character",
      },
      scene: {
        promptKey: "scene-polish",
        itemType: "scenes",
        label: "场景图",
        nameLabel: "场景",
        visualManual: isDerivative ? "art_scene_derivative" : "art_scene",
      },
      tool: {
        promptKey: "tool-polish",
        itemType: "props",
        label: "道具图",
        nameLabel: "道具",
        visualManual: isDerivative ? "art_prop_derivative" : "art_prop",
      },
    });

    // 后台异步并发生成，不阻塞响应
    const limit = pLimit(concurrentCount ?? 1);
    const tasks = items.map((item: { assetsId: number; type: string; name: string; describe: string }) =>
      limit(async () => {
        const assetData = assetsDataMap.get(item.assetsId);
        if (!assetData) return;
        const typeConfig = getTypeConfig(!!assetData.assetsId);
        const config = typeConfig[item.type];
        if (!config) return;
        //获取到视觉手册
        const visualManual = await u.getArtPrompt(project.artStyle as string, "art_skills", config.visualManual);
        if (!visualManual) {
          await u.db("o_assets").where("id", item.assetsId).update({
            promptState: "生成失败",
            promptErrorReason: `视觉手册未定义：项目画风「${project.artStyle ?? ""}」没有解析到内置视觉手册目录，请到项目配置里重新选择画风`,
            errorType: "config",
          });
          return;
        }
        // 注入补充美术维度内容（光影与氛围 / 构图与镜头 / 材质与质感）
        const visualManualDetails = u.getVisualManualDetails(project.artStyle as string);
        // 视觉手册 + 项目全局资产设定 + 用户附加指令
        const systemPrompt =
          (visualManualDetails ? `${visualManual}\n\n---\n\n${visualManualDetails}` : visualManual) +
          projectContext +
          (otherTextPrompt ? `\n\n${otherTextPrompt}` : "");
        try {
          const { _output } = (await u.Ai.Text("universalAi").invoke({
            system: systemPrompt,
            messages: [
              {
                role: "user",
                content: `
                    **基础参数：**
      **${config.nameLabel}设定：**
      - ${config.nameLabel}名称:${item.name},
      - ${config.nameLabel}描述:${item.describe},`,
              },
            ],
          })) as any;

          if (!_output) {
            await u.db("o_assets").where("id", item.assetsId).update({
              promptState: "生成失败",
              promptErrorReason: "模型没有返回提示词内容（空响应）",
              errorType: "unknown",
            });
            return;
          }

          // 成功时同时清空上一次的错误，否则错误栏会一直挂着旧报错，用户以为还在坏
          await u.db("o_assets").where("id", item.assetsId).update({
            prompt: _output,
            promptState: "已完成",
            promptErrorReason: null,
            errorType: null,
          });
        } catch (e: any) {
          const reason = u.error(e).message;
          await u
            .db("o_assets")
            .where("id", item.assetsId)
            .update({
              promptState: "生成失败",
              promptErrorReason: reason,
              errorType: classifyError(reason, { prompt: item.name }).type,
            });
        }
      }),
    );

    // 后台执行，不等待结果
    Promise.all(tasks).catch((err: any) => {
      res.status(500).send(error(err));
    });

    return res.status(200).send(success({ total: items.length }));
  },
);
