import { Socket } from "socket.io";
import u from "@/utils";
import ResTool from "@/socket/resTool";
import Memory from "@/utils/agent/memory";
import useTools from "@/agents/projectAgent/tools";
import * as fs from "fs";
import path from "path";

export interface AgentContext {
  socket: Socket;
  isolationKey: string;
  text: string;
  userMessageTime?: number;
  abortSignal?: AbortSignal;
  resTool: ResTool;
  msg: ReturnType<ResTool["newMessage"]>;
  conversationHistory: { role: "user" | "assistant"; content: string }[];
  thinkConfig: {
    think: boolean;
    thinlLevel: 0 | 1 | 2 | 3;
  };
  // 全自动创作模式：开启后无需逐轮问答，收到"开始"指令即自主完成整个项目创作
  autoMode?: boolean;
}

export async function runDecisionAI(ctx: AgentContext) {
  const { isolationKey, text, userMessageTime, abortSignal, conversationHistory } = ctx;

  // 持久化用户消息到记忆（记忆写入失败不影响对话主流程）
  const memory = new Memory("projectAgent", isolationKey);
  try {
    await memory.add("user", text, { createTime: userMessageTime });
  } catch (err) {
    console.warn("[projectAgent] 用户消息记忆写入失败:", u.error(err).message);
  }

  // 加载系统 prompt
  const skill = path.join(u.getPath("skills"), "project_agent_decision.md");
  let prompt = await fs.promises.readFile(skill, "utf-8");

  // 全自动创作模式：向系统提示词注入自动创作规则，AI 收到"开始"即自主完成全流程
  if (ctx.autoMode) {
    prompt += `
---
## 全自动创作模式（当前已启用）

用户已开启**全自动创作模式**，请严格遵守：
1. 收到"开始""开始创作"等指令后，**禁止追问任何问题、禁止要求确认**，直接自主完成整个项目创作。
2. 自行决定全部项目信息：项目类型（无明确要求时优先 novel 小说原文类型；用户明确要剧本则用 script）、项目名称、小说类型、小说简介（100-300字）、推荐画风、影片比例（短剧 9:16）。
3. 直接生成初始内容：novel 类型生成 2-3 章小说原文（每章 800-1500 字）；script 类型生成 1-2 集剧本。
4. 生成完成后立即输出完整 XML（projectInfo + novelContent/scriptContent），不等待用户确认。
5. 可输出简短进度文字（不进 XML），如"正在为您全自动创作，请稍候…"。
`;
  }

  // 将用户消息加入历史
  conversationHistory.push({ role: "user", content: text });

  const { fullStream } = await u.Ai.Text("projectAgent:decisionAgent", ctx.thinkConfig.think, ctx.thinkConfig.thinlLevel).stream({
    system: prompt,
    messages: conversationHistory,
    abortSignal,
    tools: { ...useTools({ resTool: ctx.resTool, msg: ctx.msg }) },
    onFinish: async (completion) => {
      // 将 AI 回复加入历史（去除 XML 标签后的纯文本）
      const cleanText = removeAllXmlTags(completion.text);
      conversationHistory.push({ role: "assistant", content: cleanText });
      // 持久化 AI 回复到记忆
      try {
        await memory.add("assistant:decision", cleanText);
      } catch (err) {
        console.warn("[projectAgent] AI 回复记忆写入失败:", u.error(err).message);
      }
    },
  });

  await consumeFullStream(fullStream, ctx.msg);
}

async function consumeFullStream(
  fullStream: AsyncIterable<any>,
  initialMsg: ReturnType<ResTool["newMessage"]>,
): Promise<string> {
  let msg = initialMsg;
  let text = msg.text();
  let thinking: ReturnType<typeof msg.thinking> | null = null;
  let thinkTime = 0;
  let fullResponse = "";
  // 收集工具执行失败信息，拼入返回文本，让上层能感知执行失败
  const toolErrors: string[] = [];

  try {
    for await (const chunk of fullStream) {
      if (chunk.type === "reasoning-start") {
        thinkTime = Date.now();
        thinking = msg.thinking("思考中...");
      } else if (chunk.type === "reasoning-delta") {
        thinking?.append(chunk.text);
      } else if (chunk.type === "reasoning-end") {
        thinkTime = Date.now() - thinkTime;
        thinking?.updateTitle(`思考完毕（${(thinkTime / 1000).toFixed(1)} 秒）`);
        thinking?.complete();
        thinking = null;
      } else if (chunk.type === "text-delta") {
        text.append(chunk.text);
        fullResponse += chunk.text;
      } else if (chunk.type === "tool-error") {
        // 工具执行失败，记录错误供上层感知
        const errMsg = chunk?.error?.message ?? String(chunk?.error ?? "未知错误");
        toolErrors.push(`工具 ${chunk?.toolName ?? "未知"} 执行失败: ${errMsg}`);
      } else if (chunk.type === "error") {
        throw chunk.error;
      } else if (chunk.type == "finish") {
        break;
      }
    }
    // 存在工具失败时把错误追加到回复文本，使上层能识别执行失败
    if (toolErrors.length) {
      const errText = "\n[工具执行失败]\n" + toolErrors.join("\n");
      text.append(errText);
      fullResponse += errText;
    }
    text.complete();
    msg.complete();
  } catch (err: any) {
    thinking?.complete();
    const errMsg = err?.message ?? String(err);
    text.append(errMsg);
    text.error();
    msg.error();
    throw err;
  }

  return fullResponse;
}

function removeAllXmlTags(text: string): string {
  text = text.replace(/<([a-zA-Z][\w-]*)(\s+[^>]*)?>([\s\S]*?)<\/\1>/g, "");
  text = text.replace(/<([a-zA-Z][\w-]*)(\s+[^>]*)?\/>/g, "");
  text = text.replace(/<\/?[a-zA-Z][\w-]*(\s+[^>]*)?>/g, "");
  return text.trim();
}
