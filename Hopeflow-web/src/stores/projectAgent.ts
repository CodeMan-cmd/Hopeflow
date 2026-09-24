import axios from "@/utils/axios";
import settingStore from "@/stores/setting";
import { useLocalStorage } from "@vueuse/core";
import { useChat } from "@/utils/useChat";
import type { XmlChildItem } from "@/utils/useChat";

interface ProjectInfo {
  projectType: string;
  name: string;
  type: string;
  intro: string;
  artStyle?: string;
  videoRatio?: string;
}

interface NovelChapter {
  name: string;
  content: string;
}

interface ScriptItem {
  name: string;
  content: string;
}

// AI 创建项目多会话：会话元数据（对话记录本身由后端按 isolationKey 持久化）
export interface ProjectAgentSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  // 是否已自动命名（仅首次命名生效，避免后续消息/项目名反复覆盖）
  named?: boolean;
}

const DEFAULT_SESSION_TITLE = "新会话";

// 默认会话标题带创建时间，多个会话可用时间区分
function defaultSessionTitle() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${DEFAULT_SESSION_TITLE} ${mm}/${dd} ${hh}:${mi}`;
}

const useProjectAgentStore = defineStore("projectAgent", () => {
  const projectInfo = ref<ProjectInfo | null>(null);
  const novelContent = ref<NovelChapter[]>([]);
  const scriptContent = ref<ScriptItem[]>([]);
  const error = ref<{ code: string; message: string } | null>(null);
  const xmlParsedCount = ref(0);

  // 当前会话 id（null 表示使用默认隔离键，保持向后兼容）
  const sessionKey = ref<string | null>(null);
  // 会话列表（localStorage 持久化）
  const sessions = useLocalStorage<ProjectAgentSession[]>("aiProjectSessions", []);
  // 全自动创作模式：开启后 AI 自主完成整个项目创作，无需逐轮问答
  const autoMode = ref(false);

  // 会话隔离键：默认 0:projectAgent，多会话时为 0:projectAgent:<sessionId>
  function currentIsolationKey() {
    return sessionKey.value ? `0:projectAgent:${sessionKey.value}` : "0:projectAgent";
  }

  const { connected, messages, chat, stopGenerate, socket, status, reconnect, disconnect, connect, clearMessages: chatClearMessages } = useChat({
    url: `${settingStore().baseUrl}/socket/projectAgent`,
    // 创建项目时尚未有 projectId，使用全局隔离键（与 /agents/getMemory、/agents/clearMemory 中 projectId=0 对应）
    // auth 为动态函数：切换会话（sessionKey）后重建连接即使用新隔离键
    auth: () => ({ isolationKey: currentIsolationKey() }),
    manageLifecycle: false,
    onConnect: () => {
      // 重连（切换会话/断线重连）后同步全自动创作模式到服务端
      if (autoMode.value && socket.value) {
        socket.value.emit("updateAutoMode", { autoMode: autoMode.value });
      }
    },
    onError: (err) => {
      error.value = err;
    },
    xmlTags: [
      { tag: "projectInfo", keepInMessage: false },
      { tag: "novelContent", keepInMessage: false },
      { tag: "scriptContent", keepInMessage: false },
    ],
    onXmlTag: (data) => {
      const { tag, children, status: xmlStatus } = data;

      if (xmlStatus === "complete") xmlParsedCount.value++;

      if (tag === "projectInfo" && xmlStatus === "complete") {
        const info: ProjectInfo = { projectType: "", name: "", type: "", intro: "" };
        for (const child of children) {
          if (child.tag === "projectType") info.projectType = child.value.trim();
          else if (child.tag === "name") info.name = child.value.trim();
          else if (child.tag === "type") info.type = child.value.trim();
          else if (child.tag === "intro") info.intro = child.value.trim();
          else if (child.tag === "artStyle") info.artStyle = child.value.trim();
          else if (child.tag === "videoRatio") info.videoRatio = child.value.trim();
        }
        // 校验放宽为类型与名称非空，避免 AI 输出缺字段时"填写项目信息"按钮不出现
        if (info.projectType && info.name) {
          projectInfo.value = info;
        }
      } else if (tag === "novelContent" && xmlStatus === "complete") {
        const chapters: NovelChapter[] = [];
        for (const child of children) {
          if (child.tag === "chapter") {
            chapters.push({
              name: child.attrs.name ?? "",
              content: child.value.trim(),
            });
          }
        }
        if (chapters.length) novelContent.value = chapters;
      } else if (tag === "scriptContent" && xmlStatus === "complete") {
        const items: ScriptItem[] = [];
        for (const child of children) {
          if (child.tag === "scriptItem") {
            items.push({
              name: child.attrs.name ?? "",
              content: child.value.trim(),
            });
          }
        }
        if (items.length) scriptContent.value = items;
      }
    },
    autoConnect: false,
  });

  function resetData() {
    projectInfo.value = null;
    novelContent.value = [];
    scriptContent.value = [];
  }

  function clearError() {
    error.value = null;
  }

  function clearMessages() {
    // 完整重置 useChat 内部状态（messages/xmlData/流式状态等），避免切换会话后残留
    chatClearMessages();
    resetData();
    clearError();
    xmlParsedCount.value = 0;
  }

  // ===== 会话草稿持久化：projectInfo/novelContent/scriptContent 按会话缓存，切换会话后可恢复 =====
  const DRAFT_PREFIX = "aiProjectSessionDrafts";

  function draftKey(id: string) {
    return `${DRAFT_PREFIX}:${id}`;
  }

  // 保存当前会话的解析数据草稿（空内容不保存，避免清空时覆盖已有草稿）
  function saveSessionDraft() {
    if (!sessionKey.value) return;
    if (!projectInfo.value && !novelContent.value.length && !scriptContent.value.length) return;
    try {
      localStorage.setItem(
        draftKey(sessionKey.value),
        JSON.stringify({
          projectInfo: projectInfo.value,
          novelContent: novelContent.value,
          scriptContent: scriptContent.value,
        }),
      );
    } catch {}
  }

  // 恢复指定会话的草稿（无草稿则清空）
  function restoreSessionDraft(id: string) {
    try {
      const raw = localStorage.getItem(draftKey(id));
      const draft = raw ? JSON.parse(raw) : null;
      projectInfo.value = draft?.projectInfo ?? null;
      novelContent.value = draft?.novelContent ?? [];
      scriptContent.value = draft?.scriptContent ?? [];
    } catch {
      projectInfo.value = null;
      novelContent.value = [];
      scriptContent.value = [];
    }
  }

  // 清除草稿（删除会话 / 清除消息记忆后调用）
  function clearSessionDraft(id?: string) {
    const key = id ?? sessionKey.value;
    if (key) {
      try {
        localStorage.removeItem(draftKey(key));
      } catch {}
    }
  }

  // 新建会话：生成唯一 id，加入列表并切换过去
  async function newSession(title = defaultSessionTitle()) {
    const id = `${Date.now()}`;
    sessions.value = [
      { id, title, createdAt: Date.now(), updatedAt: Date.now(), named: false },
      ...sessions.value,
    ];
    await switchSession(id);
    return id;
  }

  // 切换会话：保存当前草稿 → 清空本地状态 → 换 isolationKey 重建连接 → 拉取历史并恢复目标草稿
  async function switchSession(id: string) {
    saveSessionDraft();
    clearMessages();
    sessionKey.value = id;
    const meta = sessions.value.find((s) => s.id === id);
    if (meta) meta.updatedAt = Date.now();
    reconnect();
    try {
      await getHistory();
    } catch (err) {
      console.warn("[projectAgent] 切换会话拉取历史失败:", err);
    }
    restoreSessionDraft(id);
  }

  // 删除会话：清后端记忆 + 草稿 + 移除列表；若删除的是当前会话则切到最近一个或新建
  async function deleteSession(id: string) {
    try {
      await axios.post("/agents/clearMemory", { projectId: 0, agentType: "projectAgent", sessionId: id, type: "all" });
    } catch {}
    clearSessionDraft(id);
    sessions.value = sessions.value.filter((s) => s.id !== id);
    if (sessionKey.value === id) {
      sessionKey.value = null;
      const next = sessions.value[0];
      if (next) {
        await switchSession(next.id);
      } else {
        newSession();
      }
    }
  }

  // 更新当前会话标题（项目名 / 首条用户消息），仅首次命名生效
  function updateSessionTitle(title: string) {
    if (!title || !sessionKey.value) return;
    const meta = sessions.value.find((s) => s.id === sessionKey.value);
    if (!meta || meta.named) return;
    meta.title = title;
    meta.named = true;
    meta.updatedAt = Date.now();
  }

  // 思考档位：0 关闭 / 1 轻度 / 2 深度 / 3 极致
  const thinkLevel = ref(0);
  function updateThinkConfig(value: number) {
    thinkLevel.value = value;
    if (socket.value) {
      socket.value.emit("updateThinkConfig", { think: value > 0, thinlLevel: value });
    }
  }

  // 全自动创作模式开关：同步到服务端
  function updateAutoMode(value: boolean) {
    autoMode.value = value;
    if (socket.value) {
      socket.value.emit("updateAutoMode", { autoMode: value });
    }
  }

  // 从后端持久化记忆恢复对话历史（按当前会话隔离键）
  async function getHistory() {
    const { data } = await axios.post("/agents/getMemory", { projectId: 0, agentType: "projectAgent", sessionId: sessionKey.value ?? undefined });
    messages.value = data;
  }

  // 清除记忆（message/summary/all），消息类清除时同步重置服务端对话上下文
  async function clearMemory(type: "message" | "summary" | "all") {
    await axios.post("/agents/clearMemory", { projectId: 0, agentType: "projectAgent", sessionId: sessionKey.value ?? undefined, type });
    if (type !== "summary" && socket.value) {
      socket.value.emit("resetHistory");
    }
  }

  return {
    connected,
    messages,
    chat,
    stopGenerate,
    socket,
    status,
    reconnect,
    connect,
    disconnect,
    projectInfo,
    novelContent,
    scriptContent,
    error,
    clearError,
    resetData,
    clearMessages,
    xmlParsedCount,
    thinkLevel,
    updateThinkConfig,
    autoMode,
    updateAutoMode,
    getHistory,
    clearMemory,
    sessions,
    sessionKey,
    newSession,
    switchSession,
    deleteSession,
    updateSessionTitle,
    saveSessionDraft,
    clearSessionDraft,
  };
});

export default useProjectAgentStore;
