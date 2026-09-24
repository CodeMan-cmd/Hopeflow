import { tool, jsonSchema, Tool } from "ai";
import { z } from "zod";
import _ from "lodash";
import ResTool from "@/socket/resTool";
import u from "@/utils";
import { createPresentChoicesTool } from "@/utils/agent/presentChoices";

const deriveAssetSchema = z.object({
  id: z.number().describe("衍生资产ID,如果新增则为空"),
  assetsId: z.number().describe("关联的资产ID"),
  prompt: z.string().describe("生成提示词"),
  name: z.string().describe("衍生资产名称"),
  desc: z.string().describe("衍生资产描述"),
  src: z.string().nullable().describe("衍生资产资源路径"),
  state: z.enum(["未生成", "生成中", "已完成", "生成失败"]).describe("衍生资产生成状态"),
  type: z.enum(["role", "tool", "scene", "clip"]).describe("衍生资产类型"),
});
export const assetItemSchema = z.object({
  id: z.number().describe("资产唯一标识"),
  name: z.string().describe("资产名称"),
  type: z.enum(["role", "tool", "scene", "clip"]).describe("资产类型"),
  prompt: z.string().describe("生成提示词"),
  desc: z.string().describe("资产描述"),
  derive: z.array(deriveAssetSchema).describe("衍生资产列表"),
});
const storyboardSchema = z.object({
  id: z.number().describe("分镜ID，必须为真实id"),
  duration: z.number().describe("持续时长(秒)"),
  prompt: z.string().describe("生成提示词"),
  associateAssetsIds: z.array(z.number()).describe("关联资产ID列表"),
  src: z.string().nullable().describe("分镜资源路径"),
  index: z.number().nullable().optional().describe("分镜排序字段"),
});
const workbenchDataSchema = z.object({
  name: z.string().describe("项目名称"),
  duration: z.string().describe("视频时长"),
  resolution: z.string().describe("分辨率"),
  fps: z.string().describe("帧率"),
  cover: z.string().optional().describe("封面图片路径"),
  gradient: z.string().optional().describe("渐变色配置"),
});
const posterItemSchema = z.object({
  id: z.number().describe("海报ID"),
  image: z.string().describe("海报图片路径"),
});
export const flowDataSchema = z.object({
  script: z.string().describe("剧本内容"),
  scriptPlan: z.string().describe("拍摄计划"),
  assets: z.array(assetItemSchema).describe("衍生资产"),
  storyboardTable: z.string().describe("分镜表"),
  storyboard: z.array(storyboardSchema).describe("分镜面板"),
});

export type FlowData = z.infer<typeof flowDataSchema>;

const keySchema = z.enum(Object.keys(flowDataSchema.shape) as [keyof FlowData, ...Array<keyof FlowData>]);
const flowDataKeyLabels = Object.fromEntries(
  Object.entries(flowDataSchema.shape).map(([key, schema]) => [key, (schema as z.ZodTypeAny).description ?? key]),
) as Record<keyof FlowData, string>;

interface ToolConfig {
  resTool: ResTool;
  toolsNames?: string[];
  msg: ReturnType<ResTool["newMessage"]>;
  /** 是否禁用 present_choices 选择按钮工具（全自动模式用于强制不让 Agent 向用户弹确认按钮） */
  disablePresentChoices?: boolean;
}

/**
 * 串行队列：确保 socket 操作排队执行，避免并发过高导致假死
 * 单个任务失败不影响后续任务继续排队执行
 * @param delayMs 每个操作之间的最小间隔(ms)
 */
function createSocketQueue(delayMs = 800) {
  let lastPromise: Promise<any> = Promise.resolve();
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const run = lastPromise.then(
      () =>
        new Promise<T>((resolve, reject) => {
          setTimeout(() => fn().then(resolve, reject), delayMs);
        }),
    );
    // 链上吞掉错误保持推进，但调用方拿到的 run 仍能感知原始失败
    lastPromise = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}

/**
 * 带超时的 socket.emit：防止前端不响应回调导致工具永久挂起
 * @param socket Socket 实例
 * @param event 事件名
 * @param data 发送数据
 * @param timeoutMs 超时时间（默认 60 秒）
 */
function socketEmitWithTimeout<T = any>(socket: any, event: string, data: any, timeoutMs = 60000): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`Socket 事件 "${event}" 超时（${timeoutMs}ms 无响应）`));
    }, timeoutMs);
    socket.emit(event, data, (res: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(res);
    });
  });
}

export default (toolCpnfig: ToolConfig) => {
  const { resTool, toolsNames, msg, disablePresentChoices } = toolCpnfig;
  const { socket } = resTool;
  const socketQueue = createSocketQueue(800);
  const workMap: Record<any, any> = {};
  const tools: Record<string, Tool> = {
    get_flowData: tool({
      description: "获取工作区数据",
      inputSchema: jsonSchema<{ key: keyof FlowData }>(
        z
          .object({
            key: keySchema.describe("数据key"),
          })
          .toJSONSchema(),
      ),
      execute: async ({ key }) => {
        const thinking = msg.thinking(`正在获取${flowDataKeyLabels[key]}工作区数据...`);

        let flowData: FlowData;
        try {
          flowData = await socketEmitWithTimeout<FlowData>(socket, "getFlowData", { key });
        } catch (e) {
          thinking.appendText("获取工作区数据失败: " + u.error(e).message);
          thinking.updateTitle("获取数据失败");
          thinking.complete();
          throw e;
        }
        const rawJson = JSON.stringify(flowData[key], null, 2);
        // 数据量过大时截断打印，避免超大 thinking 内容占用带宽与渲染
        const displayJson = rawJson.length > 20000 ? rawJson.slice(0, 20000) + `\n...（数据过长，已截断，共 ${rawJson.length} 字符）` : rawJson;
        thinking.appendText(`获取到${flowDataKeyLabels[key]}:\n` + displayJson);
        thinking.updateTitle(`获取${flowDataKeyLabels[key]}完成`);
        thinking.complete();
        if (workMap[key] && JSON.stringify(workMap[key]) === JSON.stringify(flowData[key])) {
          console.info(`[tools] get_flowData: ${flowDataKeyLabels[key]}数据未变化，无需更新`);
          return `${flowDataKeyLabels[key]}数据未变化，无需更新`;
        }
        workMap[key] = flowData[key];
        return flowData[key];
      },
    }),
    add_deriveAsset: tool({
      description: "新增或更新衍生资产",
      inputSchema: jsonSchema<{ assetsId: number; id: number | null; name: string; desc: string }>(
        z
          .object({
            assetsId: z.number().describe("关联的资产ID"),
            id: z.number().nullable().describe("衍生资产ID,如果新增则为空"),
            name: z.string().describe("衍生资产名称"),
            desc: z.string().describe("衍生资产描述"),
          })
          .toJSONSchema(),
      ),
      execute: async (raw) => {
        // 容错：LLM 偶尔传 "null" 字符串或空串，统一规范为 null
        const idRaw = raw.id as unknown;
        const normalizedId = idRaw === "null" || idRaw === "" || idRaw === undefined ? null : (idRaw as number | null);
        const deriveAsset = { ...raw, id: normalizedId };

        const thinking = msg.thinking("正在操作资产...");
        const { projectId, scriptId } = resTool.data;
        const startTime = Date.now();
        const parentAssets = await u.db("o_assets").where("id", deriveAsset.assetsId).select("id", "type").first();
        if (!parentAssets) return "关联的资产不存在";

        const data = {
          id: deriveAsset.id ?? undefined,
          assetsId: deriveAsset.assetsId,
          projectId,
          name: deriveAsset.name,
          type: parentAssets.type,
          describe: deriveAsset.desc,
          startTime,
        };
        if (deriveAsset.id) {
          await u.db("o_assets").where("id", deriveAsset.id).update(data);
          thinking.appendText(`已更新衍生资产，ID: ${deriveAsset.id}\n`);
        } else {
          const [insertedId] = await u.db("o_assets").insert(data);
          data.id = insertedId;
          await u.db("o_scriptAssets").insert({ scriptId, assetId: insertedId });
          thinking.appendText(`已新增衍生资产，ID: ${insertedId}\n`);
        }
        let res: any;
        try {
          res = await socketEmitWithTimeout(socket, "addDeriveAsset", data);
        } catch (e) {
          thinking.appendText("资产操作失败: " + u.error(e).message);
          thinking.updateTitle("资产操作失败");
          thinking.complete();
          throw e;
        }
        thinking.updateTitle("资产操作完成");
        thinking.complete();
        return res ?? "操作成功";
      },
    }),
    del_deriveAsset: tool({
      description: "删除衍生资产",
      inputSchema: jsonSchema<{ assetsId: number; id: number }>(
        z
          .object({
            assetsId: z.number().describe("关联的资产ID"),
            id: z.number().describe("衍生资产ID"),
          })
          .toJSONSchema(),
      ),
      execute: async ({ assetsId, id }) => {
        const thinking = msg.thinking("正在操作资产...");
        const { scriptId } = resTool.data;
        await u.db("o_assets").where("id", id).del();
        await u.db("o_scriptAssets").where({ scriptId, assetId: id }).del();
        thinking.appendText(`已删除衍生资产，ID: ${id}\n`);
        let res: any;
        try {
          res = await socketEmitWithTimeout(socket, "delDeriveAsset", { assetsId, id });
        } catch (e) {
          thinking.appendText("删除资产失败: " + u.error(e).message);
          thinking.updateTitle("删除资产失败");
          thinking.complete();
          throw e;
        }
        thinking.updateTitle("资产操作完成");
        thinking.complete();
        return res ?? "删除成功";
      },
    }),
    generate_deriveAsset: tool({
      description: "生成衍生资产图片",
      inputSchema: jsonSchema<{ ids: number[] }>(
        z
          .object({
            ids: z.array(z.number()).describe("需要生成的 衍生资产ID"),
          })
          .toJSONSchema(),
      ),
      execute: async ({ ids }) => {
        const thinking = msg.thinking("正在生成衍生资产...");
        socketEmitWithTimeout(socket, "generateDeriveAsset", { ids })
          .then((res) => {
            thinking.appendText(`已生成衍生资产，ID: ${JSON.stringify(res, null, 2)}\n`);
            thinking.updateTitle("衍生资产开始完成");
            thinking.complete();
          })
          .catch((e) => {
            thinking.appendText("衍生资产生成失败:\n" + u.error(e).message);
            thinking.updateTitle("衍生资产生成失败");
            thinking.complete();
          });

        return "开始生成衍生资产";
      },
    }),
    generate_storyboard: tool({
      description: "生成分镜图片",
      inputSchema: jsonSchema<{ ids: number[] }>(
        z
          .object({
            ids: z.array(z.number()).describe("必须获取真实的分镜ID，支持批量生成"),
          })
          .toJSONSchema(),
      ),
      execute: async ({ ids }) => {
        const thinking = msg.thinking("正在生成分镜...");
        try {
          const res = await socketQueue(() =>
            socketEmitWithTimeout(socket, "generateStoryboard", { ids }).then((res: any) => {
              if (res?.error) throw new Error(res.error);
              return res;
            }),
          );
          thinking.appendText("生成的分镜数据:\n" + JSON.stringify(res, null, 2));
          thinking.updateTitle("分镜生成完成");
          thinking.complete();
          return JSON.stringify(res, null, 2) ?? "分镜生成完成";
        } catch (e) {
          thinking.appendText("分镜生成失败:\n" + u.error(e).message);
          thinking.updateTitle("分镜生成失败");
          thinking.complete();
          // 向上抛错，让决策层感知失败并按重试规则重新派发
          throw e;
        }
      },
    }),
    add_flowData_storyboard: tool({
      description: "新增分镜面板到工作区",
      inputSchema: jsonSchema<{
        videoDesc: string;
        prompt: string | null;
        track: string;
        duration: number;
        associateAssetsIds: number[] | null;
        shouldGenerateImage: string;
      }>(
        z
          .object({
            videoDesc: z.string().describe("画面描述（含动作/朝向/情绪）、场头场景名、关联资产名称、时长、景别、运镜、台词、音效、关联资产ID"),
            prompt: z.string().nullable().describe("分镜图片提示词"),
            track: z.string().describe("分组"),
            duration: z.number().describe("视频推荐时间"),
            associateAssetsIds: z.array(z.number()).nullable().describe("该分镜所需的资产ID列表"),
            shouldGenerateImage: z.enum(["true", "false"]).describe("是否需要生成分镜图片"),
          })
          .toJSONSchema(),
      ),
      execute: async (raw) => {
        const thinking = msg.thinking("正在新增 分镜面板 数据...");
        const data = {
          videoDesc: raw.videoDesc,
          prompt: raw.prompt,
          track: raw.track,
          duration: raw.duration,
          associateAssetsIds: raw.associateAssetsIds ?? [],
          shouldGenerateImage: raw.shouldGenerateImage,
        };
        try {
          const res = await socketQueue(() =>
            socketEmitWithTimeout(socket, "addStoryboard", { ...data }).then((res: any) => {
              if (res?.error || res?.success === false) throw new Error(res?.message || res?.error || "新增分镜失败");
              return res;
            }),
          );
          thinking.appendText("新增的分镜数据:\n" + JSON.stringify(data, null, 2));
          thinking.updateTitle("新增分镜成功");
          thinking.complete();
          return res ?? "新增分镜成功";
        } catch (e) {
          thinking.appendText("新增分镜失败: " + u.error(e).message);
          thinking.updateTitle("新增分镜失败");
          thinking.complete();
          // 向上抛错，让决策层感知失败并按重试规则重新派发
          throw e;
        }
      },
    }),
    update_flowData_storyboard: tool({
      description: "更新分镜面板中的单条分镜，只需传入要修改的字段",
      inputSchema: jsonSchema<{
        id: number;
        videoDesc?: string;
        prompt?: string | null;
        track?: string;
        duration?: number;
        associateAssetsIds?: number[] | null;
        shouldGenerateImage?: string;
      }>(
        z
          .object({
            id: z.number().describe("要更新的分镜ID，必须为真实id"),
            videoDesc: z.string().optional().describe("画面描述（含动作/朝向/情绪）、场头场景名、关联资产名称、时长、景别、运镜、台词、音效、关联资产ID"),
            prompt: z.string().nullable().optional().describe("分镜图片提示词"),
            track: z.string().optional().describe("分组"),
            duration: z.number().optional().describe("视频推荐时间(秒)"),
            associateAssetsIds: z.array(z.number()).nullable().optional().describe("该分镜所需的资产ID列表"),
            shouldGenerateImage: z.enum(["true", "false"]).optional().describe("是否需要生成分镜图片"),
          })
          .toJSONSchema(),
      ),
      execute: async (raw) => {
        const thinking = msg.thinking("正在更新 分镜面板 数据...");
        const data: Record<string, any> = { id: raw.id };
        if (raw.videoDesc !== undefined) data.videoDesc = raw.videoDesc;
        if (raw.prompt !== undefined) data.prompt = raw.prompt;
        if (raw.track !== undefined) data.track = raw.track;
        if (raw.duration !== undefined) data.duration = raw.duration;
        if (raw.associateAssetsIds !== undefined) data.associateAssetsIds = raw.associateAssetsIds;
        if (raw.shouldGenerateImage !== undefined) data.shouldGenerateImage = raw.shouldGenerateImage;
        try {
          const res = await socketQueue(() =>
            socketEmitWithTimeout(socket, "updateStoryboard", data).then((res: any) => {
              if (res?.error || res?.success === false) throw new Error(res?.message || res?.error || "更新分镜失败");
              return res;
            }),
          );
          thinking.appendText("更新的分镜数据:\n" + JSON.stringify(data, null, 2));
          thinking.updateTitle("更新分镜成功");
          thinking.complete();
          return res ?? "更新分镜成功";
        } catch (e) {
          thinking.appendText("更新的分镜数据:\n" + JSON.stringify(data, null, 2));
          thinking.updateTitle("更新分镜失败");
          thinking.complete();
          // 向上抛错，让决策层感知失败并按重试规则重新派发
          throw e;
        }
      },
    }),
    del_flowData_storyboard: tool({
      description: "删除分镜面板中的单条分镜",
      inputSchema: jsonSchema<{ id: number }>(
        z
          .object({
            id: z.number().describe("要删除的分镜ID，必须为真实id"),
          })
          .toJSONSchema(),
      ),
      execute: async ({ id }) => {
        const thinking = msg.thinking("正在删除 分镜面板 数据...");
        try {
          const res = await socketQueue(() =>
            socketEmitWithTimeout(socket, "delStoryboard", { id }).then((res: any) => {
              if (res?.error || res?.success === false) throw new Error(res?.message || res?.error || "删除分镜失败");
              return res;
            }),
          );
          thinking.appendText(`已删除分镜，ID: ${id}\n`);
          thinking.updateTitle("删除分镜成功");
          thinking.complete();
          return res ?? `删除分镜成功，ID: ${id}`;
        } catch (e) {
          thinking.appendText(`删除分镜失败，ID: ${id}\n` + u.error(e).message);
          thinking.updateTitle("删除分镜失败");
          thinking.complete();
          // 向上抛错，让决策层感知失败并按重试规则重新派发
          throw e;
        }
      },
    }),
    present_choices: createPresentChoicesTool({ msg }),
  };

  if (disablePresentChoices) {
    delete tools.present_choices;
  }
  return toolsNames ? Object.fromEntries(Object.entries(tools).filter(([n]) => toolsNames.includes(n))) : tools;
};
