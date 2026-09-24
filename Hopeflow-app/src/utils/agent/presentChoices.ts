import { tool, jsonSchema } from "ai";
import { z } from "zod";
import ResTool from "@/socket/resTool";

/**
 * 创建「选择按钮」工具：将选项以可点击按钮形式呈现给用户。
 * 前端渲染链路复用 suggestion 内容类型（resTool.suggestion），点击按钮后自动发送 prompt。
 * @param msg 当前消息构建器，用于向当前消息追加 suggestion 内容块
 */
export function createPresentChoicesTool({ msg }: { msg: ReturnType<ResTool["newMessage"]> }) {
  return tool({
    description:
      "将选择项以可点击的按钮形式呈现给用户。当你需要用户在多个选项中做出选择，或需要用户确认某个决策时调用本工具，调用后停止提问并等待用户点击按钮或回复。",
    inputSchema: jsonSchema<{ options: { title: string; prompt?: string }[] }>(
      z
        .object({
          options: z
            .array(
              z.object({
                title: z.string().describe("按钮显示文案，简短，不超过12个字"),
                prompt: z.string().optional().describe("用户点击按钮后发送给你的指令内容，缺省时使用 title"),
              }),
            )
            .min(1)
            .max(6)
            .describe("选项按钮列表，2-4个为宜"),
        })
        .toJSONSchema(),
    ),
    execute: async ({ options }) => {
      msg.suggestion(options.map((o) => ({ title: o.title, prompt: o.prompt ?? o.title })));
      return `已向用户呈现 ${options.length} 个选择按钮`;
    },
  });
}
