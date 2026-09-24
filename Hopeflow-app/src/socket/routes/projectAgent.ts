import jwt from "jsonwebtoken";
import u from "@/utils";
import { Namespace, Socket } from "socket.io";
import * as agent from "@/agents/projectAgent/index";
import ResTool from "@/socket/resTool";

async function verifyToken(rawToken: string): Promise<Boolean> {
  const setting = await u.db("o_setting").where("key", "tokenKey").select("value").first();
  if (!setting) return false;
  const { value: tokenKey } = setting;
  if (!rawToken) return false;
  const token = rawToken.replace("Bearer ", "");
  try {
    jwt.verify(token, tokenKey as string);
    return true;
  } catch (err) {
    return false;
  }
}

// 从持久化记忆恢复完整对话历史（重连/刷新后上下文不丢失）
async function loadConversationHistory(isolationKey: string): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const rows = await u
    .db("memories")
    .where({ isolationKey, type: "message" })
    .orderBy("createTime", "asc")
    .select("role", "content");
  return rows
    .filter((r: any) => r.role === "user" || String(r.role).startsWith("assistant"))
    .map((r: any) => ({ role: String(r.role).startsWith("assistant") ? "assistant" : "user", content: r.content }));
}

export default (nsp: Namespace) => {
  nsp.on("connection", async (socket: Socket) => {
    const token = socket.handshake.auth.token;
    if (!token || !(await verifyToken(token))) {
      console.log("[projectAgent] 连接失败，token无效");
      socket.disconnect();
      return;
    }
    const isolationKey = socket.handshake.auth.isolationKey;
    if (!isolationKey) {
      console.log("[projectAgent] 连接失败，缺少 isolationKey");
      socket.disconnect();
      return;
    }

    console.log("[projectAgent] 已连接:", socket.id);

    const resTool = new ResTool(socket);
    let abortController: AbortController | null = null;

    // 对话历史（连接时从持久化记忆恢复，叉掉重开/刷新后仍能继续对话）
    // 恢复失败时降级为空历史，不影响对话主流程
    let conversationHistory: { role: "user" | "assistant"; content: string }[] = [];
    try {
      conversationHistory = await loadConversationHistory(isolationKey);
    } catch (err) {
      console.warn("[projectAgent] 对话历史恢复失败:", u.error(err).message);
    }

    const thinkConfig: agent.AgentContext["thinkConfig"] = {
      think: false,
      thinlLevel: 0,
    };

    // 全自动创作模式：前端开关控制，开启后 Agent 自主完成整个项目创作
    let autoMode = false;

    socket.on("chat", async (data: { content: string }) => {
      const { content } = data;
      abortController?.abort();
      abortController = new AbortController();
      const currentController = abortController;

      const msg = resTool.newMessage("assistant", "项目创建助手");

      const ctx: agent.AgentContext = {
        socket,
        isolationKey,
        text: content,
        userMessageTime: new Date(msg.datetime).getTime() - 1,
        abortSignal: currentController.signal,
        resTool,
        msg,
        conversationHistory,
        thinkConfig,
        autoMode,
      };

      try {
        await agent.runDecisionAI(ctx);
      } catch (err: any) {
        if (err.name !== "AbortError" && !currentController.signal.aborted) {
          console.error("[projectAgent] chat error:", u.error(err).message);
          msg.error(u.error(err).message);
          socket.emit("error", { code: "PROJECT_AGENT_ERROR", message: u.error(err).message });
        }
      } finally {
        if (abortController === currentController) {
          abortController = null;
        }
      }
    });

    socket.on("updateThinkConfig", (data: { think: boolean; thinlLevel: 0 | 1 | 2 | 3 }) => {
      thinkConfig.think = data.think;
      thinkConfig.thinlLevel = data.thinlLevel;
      console.log("[projectAgent] 更新思考配置:", thinkConfig);
    });

    socket.on("updateAutoMode", (data: { autoMode: boolean }) => {
      autoMode = data.autoMode;
      console.log("[projectAgent] 更新全自动创作模式:", autoMode);
    });

    // 清除消息/全部记忆后重置本地对话历史，保证服务端上下文同步清空
    socket.on("resetHistory", () => {
      conversationHistory.length = 0;
      console.log("[projectAgent] 已重置对话历史");
    });

    socket.on("stop", () => {
      abortController?.abort();
      abortController = null;
    });

    // 连接断开时中止正在执行的任务，避免在已断开连接上空跑浪费资源
    socket.on("disconnect", (reason) => {
      console.log("[projectAgent] 连接断开:", socket.id, reason);
      abortController?.abort();
      abortController = null;
    });
  });
  nsp.on("disconnect", (socket: Socket) => {
    console.log("[projectAgent] 已断开连接:", socket.id);
  });
};
