<template>
  <t-dialog
    v-model:visible="dialogVisible"
    placement="center"
    width="80%"
    :max-width="960"
    :footer="false"
    @close-btn-click="handleClose"
    @cancel="handleClose">
    <template #header>
      <div class="dialogHeader">
        <div class="dialogTitle">{{ $t("workbench.project.aiDialog.title") }}</div>
        <div class="dialogSubtitle">{{ $t("workbench.project.aiDialog.subtitle") }}</div>
      </div>
    </template>
    <div class="aiProjectChat">
      <!-- 多会话侧边栏：新建 / 搜索 / 切换 / 删除会话 -->
      <div class="sessionSidebar">
        <div class="sidebarHeader">
          <span class="sidebarTitle">{{ $t("workbench.project.aiDialog.sessions") }}</span>
          <t-tooltip :content="$t('workbench.project.aiDialog.newSession')">
            <t-button shape="square" size="small" variant="outline" @click="handleNewSession">
              <template #icon>
                <i-add size="16" />
              </template>
            </t-button>
          </t-tooltip>
        </div>
        <t-input
          v-model="searchText"
          size="small"
          clearable
          :placeholder="$t('workbench.project.aiDialog.searchSession')">
          <template #prefix-icon>
            <i-search size="14" />
          </template>
        </t-input>
        <div class="sessionList">
          <div
            v-for="s in filteredSessions"
            :key="s.id"
            class="sessionItem"
            :class="{ active: s.id === sessionKey }"
            :title="sessionTip(s)"
            @click="handleSwitchSession(s.id)">
            <span class="sessionItemTitle">{{ s.title }}</span>
            <span class="sessionItemMeta">
              <span class="sessionItemTime">{{ fmtTime(s.createdAt) }}</span>
              <span class="sessionItemDel" @click.stop="handleDeleteSession(s.id)">
                <i-delete size="12" />
              </span>
            </span>
          </div>
          <div v-if="!filteredSessions.length" class="sessionEmpty">
            {{ $t("workbench.project.aiDialog.noSession") }}
          </div>
        </div>
      </div>
      <div class="chatArea">
      <div class="chatBox">
        <t-chat-list :clear-history="false">
          <t-chat-message
            v-for="message in messages"
            :key="message.id"
            :message="message"
            :name="(message as any).name"
            :placement="message.role === 'user' ? 'right' : 'left'"
            :variant="message.role === 'user' ? 'base' : 'outline'"
            :handleActions="message.role === 'user' ? {} : handleActions"
            :status="message.status"
            allowContentSegmentCustom />
        </t-chat-list>
        <!-- 快捷指令：会话尚未开始对话时展示通用按钮，一键发起 -->
        <div class="quickActions" v-if="!hasUserMsg">
          <div class="autoModeRow">
            <t-switch v-model="autoModeSwitch" size="small" />
            <span class="autoModeLabel">{{ $t("workbench.project.aiDialog.autoMode") }}</span>
            <t-tooltip :content="$t('workbench.project.aiDialog.autoModeDesc')">
              <i-help size="14" class="autoModeHelp" />
            </t-tooltip>
          </div>
          <t-button
            v-if="autoMode"
            theme="primary"
            size="small"
            :disabled="status === 'pending' || status === 'streaming' || !connected"
            @click="handleQuickAction(startPrompt)">
            <template #icon><i-play :size="14" /></template>
            {{ $t("workbench.project.aiDialog.startCreate") }}
          </t-button>
          <template v-else>
            <t-button
              v-for="q in quickActions"
              :key="q.key"
              size="small"
              :variant="q.key === 'createNew' ? 'base' : 'outline'"
              :theme="q.key === 'createNew' ? 'primary' : 'default'"
              :disabled="status === 'pending' || status === 'streaming' || !connected"
              @click="handleQuickAction(q.prompt)">
              <template #icon>
                <i-add v-if="q.key === 'createNew'" :size="14" />
                <i-book v-else-if="q.key === 'adaptNovel'" :size="14" />
                <i-document v-else :size="14" />
              </template>
              {{ q.label }}
            </t-button>
          </template>
        </div>
        <div class="alertArea" v-if="error || hint">
          <div v-if="error" class="alertBox alertError">
            <div class="alertText">
              <span class="alertMsg">{{ error.message }}</span>
              <span class="alertGuide">{{ $t("workbench.project.aiDialog.errorGuide") }}</span>
            </div>
            <t-button size="small" variant="outline" @click="handleRegenerate">
              {{ $t("workbench.project.aiDialog.regenerate") }}
            </t-button>
          </div>
          <div v-else class="alertBox alertWarning">
            <span class="alertMsg">{{ $t("workbench.project.aiDialog.noXmlHint") }}</span>
            <t-button size="small" variant="outline" @click="handleRegenerate">
              {{ $t("workbench.project.aiDialog.regenerate") }}
            </t-button>
          </div>
        </div>
        <t-chat-sender
          class="inputBox"
          :disabled="status === 'pending' || status === 'streaming' || !connected"
          v-model="inputValue"
          :loading="status === 'pending' || status === 'streaming'"
          :placeholder="$t('workbench.project.aiDialog.inputPlaceholder')"
          @send="handleSend"
          @stop="handleStop">
          <template #footer-prefix>
            <div class="ac" style="gap: 5px">
              <t-popup trigger="click" placement="top-left">
                <t-button shape="square" variant="outline" size="small">
                  <template #icon>
                    <i-setting-config size="16" />
                  </template>
                </t-button>
                <template #content>
                  <div class="settingMenu">
                    <div class="settingMenuItem" @click="handleReconnect()">
                      <i-api size="14" />
                      <span>{{ $t("workbench.project.aiDialog.reconnect") }}</span>
                    </div>
                    <div class="settingMenuItem" @click="handleClearMemory('message')">
                      <i-delete size="14" />
                      <span>{{ $t("workbench.project.aiDialog.clearMessageMemory") }}</span>
                    </div>
                    <div class="settingMenuItem" @click="handleClearMemory('summary')">
                      <i-close size="14" />
                      <span>{{ $t("workbench.project.aiDialog.clearSummaryMemory") }}</span>
                    </div>
                    <div class="settingMenuItem danger" @click="handleClearMemory('all')">
                      <i-delete-one size="14" />
                      <span>{{ $t("workbench.project.aiDialog.clearAllMemory") }}</span>
                    </div>
                  </div>
                </template>
              </t-popup>
              <t-popup trigger="click" placement="top" v-if="showThink">
                <t-button size="small" variant="outline" :theme="(['default', 'success', 'warning', 'danger'] as const)[thinkLevel] || 'default'">
                  <template #icon>
                    <i-tips size="16" />
                  </template>
                  {{ thinkLevelOptions[thinkLevel]?.label }}
                </t-button>
                <template #content>
                  <div class="settingMenu">
                    <div
                      v-for="opt in thinkLevelOptions"
                      :key="opt.value"
                      class="settingMenuItem"
                      :class="{ active: thinkLevel === opt.value }"
                      @click="store.updateThinkConfig(opt.value)">
                      <span>{{ opt.label }}</span>
                    </div>
                  </div>
                </template>
              </t-popup>
            </div>
          </template>
        </t-chat-sender>
      </div>
      <template v-if="projectInfo">
        <div class="footerBar">
          <div class="footerCard f ac jb">
            <div class="previewInfo">
              <t-tag theme="primary" variant="light">
                {{ projectInfo.projectType === "novel" ? $t("workbench.project.dialog.basedOnNovel") : $t("workbench.project.dialog.basedOnScript") }}
              </t-tag>
              <span class="projectName">{{ projectInfo.name }}</span>
              <div class="projectTags f ac">
                <t-tag v-if="projectInfo.type" variant="outline" size="small">{{ projectInfo.type }}</t-tag>
                <t-tag v-if="projectInfo.artStyle" variant="outline" size="small">{{ projectInfo.artStyle }}</t-tag>
                <t-tag v-if="projectInfo.videoRatio" variant="outline" size="small">{{ projectInfo.videoRatio }}</t-tag>
              </div>
            </div>
            <t-button theme="primary" @click="handleFillForm">
              <template #icon><i-check :size="16" /></template>
              {{ $t("workbench.project.aiDialog.fillForm") }}
            </t-button>
          </div>
          <div class="contentList" v-if="novelContent.length || scriptContent.length">
            <div class="contentGroup" v-if="novelContent.length">
              <span class="groupLabel">{{ $t("workbench.project.dialog.basedOnNovel") }}</span>
              <div v-for="(c, i) in novelContent" :key="`n${i}`" class="contentItem">
                <span class="contentDot"></span>
                <span class="contentName">{{ c.name }}</span>
                <span class="contentLen">{{ c.content.length }}字</span>
              </div>
            </div>
            <div class="contentGroup" v-if="scriptContent.length">
              <span class="groupLabel">{{ $t("workbench.project.dialog.basedOnScript") }}</span>
              <div v-for="(s, i) in scriptContent" :key="`s${i}`" class="contentItem">
                <span class="contentDot"></span>
                <span class="contentName">{{ s.name }}</span>
                <span class="contentLen">{{ s.content.length }}字</span>
              </div>
            </div>
          </div>
        </div>
      </template>
      </div>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
import useProjectAgentStore, { type ProjectAgentSession } from "@/stores/projectAgent";

const dialogVisible = defineModel<boolean>();
const emit = defineEmits<{
  (e: "complete", data: { projectInfo: any; novelContent: any[]; scriptContent: any[] }): void;
}>();

const store = useProjectAgentStore();
const { connected, messages, status, projectInfo, novelContent, scriptContent, error, thinkLevel, sessions, sessionKey, autoMode } = storeToRefs(store);

const inputValue = ref("");

// 全自动创作模式开关（同步到 store 并通知服务端）
const autoModeSwitch = computed({
  get: () => autoMode.value,
  set: (v: boolean) => store.updateAutoMode(v),
});
// 全自动创作模式下发送给 AI 的启动指令
const startPrompt = "开始创作";

// 会话时间格式化（MM/DD HH:mm），用于未命名会话标题与悬浮提示
function fmtTime(ts: number) {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}

// 新会话默认标题：带创建时间，多个会话可用时间区分
function defaultSessionTitle() {
  return `${$t("workbench.project.aiDialog.newSession")} ${fmtTime(Date.now())}`;
}

// 会话悬浮提示：标题 + 创建时间
function sessionTip(s: ProjectAgentSession) {
  return `${s.title} · ${fmtTime(s.createdAt)}`;
}

// 会话搜索：按标题过滤
const searchText = ref("");
const filteredSessions = computed(() => {
  const kw = searchText.value.trim().toLowerCase();
  if (!kw) return sessions.value;
  return sessions.value.filter((s) => s.title.toLowerCase().includes(kw));
});

// 会话是否已有用户消息（用于控制快捷指令按钮的展示）
const hasUserMsg = computed(() => messages.value.some((m) => m.role === "user"));

// 通用快捷指令：会话尚未开始对话时展示，一键发起
const quickActions = computed(() => [
  {
    key: "createNew",
    label: $t("workbench.project.aiDialog.createNew"),
    prompt: "我想创作一部全新的短剧，请先了解我想要的类型、题材、画风和故事设定，再帮我创建项目",
  },
  {
    key: "adaptNovel",
    label: $t("workbench.project.aiDialog.adaptNovel"),
    prompt: "我想把一部小说改编成短剧，请先告诉我需要提供哪些内容（如小说章节、简介），然后帮我创建项目",
  },
  {
    key: "fromScript",
    label: $t("workbench.project.aiDialog.fromScript"),
    prompt: "我有一份剧本，想基于它创建短剧项目并完善，请先告诉我接下来需要怎么做",
  },
]);

function handleQuickAction(text: string) {
  // 全自动模式的启动指令是系统指令，跳过标题占用
  handleSend(text, { skipTitle: text === startPrompt });
}

// 快捷选择按钮：点击 Agent 下发的 suggestion 按钮后自动发送对应指令
const handleActions = {
  suggestion: (data?: any) => {
    const text = data?.content?.prompt;
    if (text) {
      store.updateSessionTitle(String(text).replace(/\s+/g, "").slice(0, 20));
      store.chat(text);
    }
  },
};

// AI 未输出结构化 XML 时的提示
const hint = ref(false);
// 是否已点过"填写项目信息"（已消费生成内容，关闭无需二次确认）
const filledForm = ref(false);

// 思考档位选项（0 关闭 / 1 轻度 / 2 深度 / 3 极致）
const thinkLevelOptions = [
  { label: $t("workbench.project.aiDialog.thinkLevel.off"), value: 0 },
  { label: $t("workbench.project.aiDialog.thinkLevel.light"), value: 1 },
  { label: $t("workbench.project.aiDialog.thinkLevel.deep"), value: 2 },
  { label: $t("workbench.project.aiDialog.thinkLevel.extreme"), value: 3 },
];
// 当前模型是否支持思考
const showThink = ref(false);
onMounted(async () => {
  try {
    const { data } = await axios.post("/project/getModelDetails", { key: "projectAgent" });
    if (data && data.think) {
      showThink.value = true;
    }
  } catch {}
});

// 触发 AI 直接输出结构化 XML 的重试指令
const REGENERATE_PROMPT = "请直接重新输出完整的项目信息与内容 XML 数据（projectInfo、novelContent 或 scriptContent），并确保所有标签完整闭合";

function pushWelcome() {
  messages.value.push({
    id: `ai_welcome_${Date.now()}`,
    role: "assistant",
    name: "项目创建助手",
    status: "complete",
    datetime: new Date().toISOString(),
    content: [{ type: "text", data: $t("workbench.project.aiDialog.welcome"), status: "complete" }],
  } as any);
}

function handleSend(text: string, opts?: { skipTitle?: boolean }) {
  roundStartXmlCount = store.xmlParsedCount;
  hint.value = false;
  store.clearError();
  // 系统指令（如全自动模式的"开始创作"）不占用会话标题，留给后续项目名命名
  if (text && !opts?.skipTitle) {
    store.updateSessionTitle(text.replace(/\s+/g, "").slice(0, 20));
  }
  store.chat(text);
  inputValue.value = "";
}

function handleStop() {
  store.stopGenerate();
}

function handleRegenerate() {
  handleSend(REGENERATE_PROMPT);
}

function handleReconnect() {
  const dialog = DialogPlugin.confirm({
    header: $t("workbench.project.aiDialog.reconnect"),
    body: $t("workbench.project.aiDialog.notReconnect"),
    confirmBtn: $t("workbench.project.aiDialog.keepReconnect"),
    cancelBtn: $t("workbench.project.aiDialog.cancel"),
    theme: "warning",
    onConfirm: async () => {
      store.reconnect();
      dialog.destroy();
    },
  });
}

const memoryTypeLabel: Record<string, string> = {
  message: $t("workbench.project.aiDialog.messageMemory"),
  summary: $t("workbench.project.aiDialog.summaryMemory"),
  all: $t("workbench.project.aiDialog.allMemory"),
};
function handleClearMemory(type: "message" | "summary" | "all") {
  const dialog = DialogPlugin.confirm({
    header: $t("workbench.project.aiDialog.confirmClear"),
    body: $t("workbench.project.aiDialog.confirmClearBody", { type: memoryTypeLabel[type] }),
    confirmBtn: $t("workbench.project.aiDialog.confirmClearBtn"),
    cancelBtn: $t("workbench.project.aiDialog.cancel"),
    theme: "warning",
    onConfirm: async () => {
      try {
        await store.clearMemory(type);
      } catch (e) {
        dialog.destroy();
        window.$message.error((e as any)?.message ?? $t("workbench.project.aiDialog.clearFailed"));
        return;
      }
      window.$message.success($t("workbench.project.aiDialog.memoryCleared", { type: memoryTypeLabel[type] }));
      dialog.destroy();
      if (type !== "summary") {
        // 消息/全部记忆被清除：重置本地对话与解析数据（含草稿），并恢复欢迎语
        store.clearMessages();
        store.clearSessionDraft();
        hint.value = false;
        await store.getHistory();
        pushWelcome();
      }
    },
  });
}

function handleFillForm() {
  filledForm.value = true;
  emit("complete", {
    projectInfo: { ...projectInfo.value },
    novelContent: [...novelContent.value],
    scriptContent: [...scriptContent.value],
  });
  handleClose();
}

function doClose() {
  store.disconnect();
  hint.value = false;
  filledForm.value = false;
  dialogVisible.value = false;
}

function handleClose() {
  const hasContent = !!projectInfo.value || novelContent.value.length > 0 || scriptContent.value.length > 0;
  // 已生成内容且尚未使用，关闭前需确认，避免误关丢失
  if (hasContent && !filledForm.value) {
    const dialog = DialogPlugin.confirm({
      header: $t("workbench.project.aiDialog.closeConfirmHeader"),
      body: $t("workbench.project.aiDialog.closeConfirmBody"),
      confirmBtn: $t("workbench.project.aiDialog.closeConfirmOk"),
      cancelBtn: $t("workbench.project.aiDialog.closeConfirmCancel"),
      onConfirm: () => {
        dialog.destroy();
        doClose();
      },
    });
    return;
  }
  doClose();
}

// 本轮发送时已解析的 XML 数量，用于判断本轮 AI 是否输出过结构化数据
let roundStartXmlCount = 0;

// 本轮 AI 回复完成后若未解析到任何结构化 XML，且对话已进行多轮，提示可重新生成
watch(status, (val) => {
  if (val !== "idle" || hint.value || projectInfo.value) return;
  const userMsgCount = messages.value.filter((m) => m.role === "user").length;
  if (userMsgCount < 2) return;
  const lastAssistant = [...messages.value].reverse().find((m) => m.role === "assistant");
  if (lastAssistant && (lastAssistant as any).status === "complete" && store.xmlParsedCount === roundStartXmlCount) {
    hint.value = true;
  }
});

watch(dialogVisible, async (visible) => {
  if (visible) {
    hint.value = false;
    filledForm.value = false;
    // 打开对话框：优先复用最新的空会话（无对话、未生成项目），否则新建会话，
    // 满足"重新创建项目"场景——不与上一个已完成的会话混谈
    const latest = sessions.value[0];
    const hasUserMsg = messages.value.some((m) => m.role === "user");
    const latestIsCurrent = !!latest && latest.id === sessionKey.value;
    const latestIsEmpty =
      latestIsCurrent && !store.projectInfo && !store.novelContent.length && !store.scriptContent.length && !hasUserMsg;
    if (latestIsEmpty) {
      await store.getHistory();
      if (messages.value.length === 0) {
        pushWelcome();
      }
    } else {
      await store.newSession(defaultSessionTitle());
      pushWelcome();
    }
    store.connect();
  }
});

// 切换会话：加载目标会话历史，空会话补欢迎语
async function handleSwitchSession(id: string) {
  if (id === sessionKey.value) return;
  if (status.value === "pending" || status.value === "streaming") {
    store.stopGenerate();
  }
  await store.switchSession(id);
  if (messages.value.length === 0) {
    pushWelcome();
  }
}

// 新建会话
async function handleNewSession() {
  if (status.value === "pending" || status.value === "streaming") {
    store.stopGenerate();
  }
  await store.newSession(defaultSessionTitle());
  pushWelcome();
}

// 删除会话：二次确认后删除后端记忆并移除列表
function handleDeleteSession(id: string) {
  const dialog = DialogPlugin.confirm({
    header: $t("workbench.project.aiDialog.confirmDelete"),
    body: $t("workbench.project.aiDialog.deleteSessionConfirm"),
    confirmBtn: $t("workbench.project.aiDialog.confirmDeleteBtn"),
    cancelBtn: $t("workbench.project.aiDialog.cancel"),
    theme: "warning",
    onConfirm: async () => {
      dialog.destroy();
      const isCurrent = id === sessionKey.value;
      await store.deleteSession(id);
      if (isCurrent && messages.value.length === 0) {
        pushWelcome();
      }
    },
  });
}

// 解析到项目名后更新当前会话标题（仅首次命名生效）
watch(projectInfo, (info) => {
  if (info?.name) {
    store.updateSessionTitle(info.name);
  }
});

// 解析数据变化时自动保存会话草稿，切换会话后可恢复项目信息（避免切走后按钮丢失）
watch(
  [projectInfo, novelContent, scriptContent],
  () => {
    store.saveSessionDraft();
  },
  { deep: true },
);

onUnmounted(() => {
  store.disconnect();
});
</script>

<style lang="scss" scoped>
// 弹窗头部：主标题 + 副标题
.dialogHeader {
  display: flex;
  flex-direction: column;
  gap: 2px;

  .dialogTitle {
    font-size: 16px;
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  .dialogSubtitle {
    font-size: 12px;
    color: var(--td-text-color-placeholder);
  }
}

.aiProjectChat {
  height: 75vh;
  display: flex;
  flex-direction: row;

  .sessionSidebar {
    flex-shrink: 0;
    width: 236px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 4px 12px 4px 0;
    border-right: 1px solid var(--td-component-border);

    .sidebarHeader {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 2px 4px;

      .sidebarTitle {
        font-size: 14px;
        font-weight: 600;
        color: var(--td-text-color-primary);
      }
    }

    .sessionList {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 4px;

      &::-webkit-scrollbar {
        width: 4px;
      }
    }

    .sessionItem {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 7px 10px;
      border-radius: var(--td-radius-small, 3px);
      font-size: 13px;
      cursor: pointer;
      flex-shrink: 0;
      transition: background-color 0.2s ease;

      &:hover {
        background: var(--td-bg-color-secondarycontainer, #f3f3f3);

        .sessionItemDel {
          opacity: 1;
          color: var(--td-error-color);
        }
      }

      &.active {
        background: var(--td-brand-color-light, #e8f3ff);
        color: var(--td-brand-color, #0052d9);
        font-weight: 600;
        box-shadow: inset 3px 0 0 var(--td-brand-color, #0052d9);
      }

      .sessionItemTitle {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .sessionItemMeta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 11px;
        opacity: 0.65;
      }

      .sessionItemDel {
        display: flex;
        align-items: center;
        opacity: 0.35;
        cursor: pointer;
        transition: opacity 0.2s ease;

        &:hover {
          opacity: 1;
          color: var(--td-error-color);
        }
      }
    }

    .sessionEmpty {
      padding: 16px 0;
      text-align: center;
      font-size: 12px;
      color: var(--td-text-color-placeholder, #999);
    }
  }

  .chatArea {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;

    .chatBox {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;

      :deep(.t-chat__list) {
        flex: 1;
        overflow-y: auto;
        padding: 8px 12px;
        // 商务化收敛：缩小消息气泡圆角与消息间距，弱化"AI 聊天"感
        --td-chat-item-text-radius: var(--td-radius-medium, 6px);
        --td-chat-item-content-radius: var(--td-radius-medium, 6px);
        --td-chat-item-gap: 24px;
      }

      :deep(.t-chat-item) {
        margin: 8px 0;
      }

      .quickActions {
        flex-shrink: 0;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        padding: 8px 12px 0;

        .autoModeRow {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 12px;
          border-radius: var(--td-radius-medium, 6px);
          background: var(--td-bg-color-secondarycontainer, #f3f3f3);

          .autoModeLabel {
            font-size: 12px;
            font-weight: 500;
            color: var(--td-text-color-secondary);
          }

          .autoModeHelp {
            color: var(--td-text-color-placeholder);
            cursor: help;
          }
        }
      }

      .alertArea {
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px 12px 0;

        .alertBox {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 14px;
          border-radius: var(--td-radius-medium, 6px);
          font-size: 14px;

          .alertText {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .alertMsg {
            color: var(--td-text-color-primary);
          }

          .alertGuide {
            font-size: 12px;
            color: var(--td-text-color-secondary);
          }
        }

        .alertError {
          background: var(--td-error-color-light);
          border: 1px solid var(--td-error-color);

          .alertMsg {
            color: var(--td-error-color);
          }
        }

        .alertWarning {
          background: var(--td-warning-color-light);
          border: 1px solid var(--td-warning-color);
        }
      }

      .inputBox {
        flex-shrink: 0;

        :deep(.t-chat-sender) {
          border-radius: var(--td-radius-medium, 6px);
          overflow: hidden;
        }
      }
    }
  }

  .footerBar {
    flex-shrink: 0;
    padding: 12px 0 0;

    .footerCard {
      padding: 12px 16px;
      border-radius: var(--td-radius-medium, 6px);
      background: var(--td-bg-color-secondarycontainer, #f3f3f3);

      .previewInfo {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;

        .projectName {
          font-size: 18px;
          font-weight: 600;
          color: var(--td-text-color-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .projectTags {
          gap: 6px;
        }
      }
    }
  }

  .contentList {
    flex-shrink: 0;
    max-height: 132px;
    overflow-y: auto;
    padding: 10px 4px 0;

    .contentGroup {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-bottom: 8px;

      .groupLabel {
        font-size: 12px;
        font-weight: 500;
        color: var(--td-text-color-placeholder);
      }
    }

    .contentItem {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 3px 0;
      font-size: 14px;

      .contentDot {
        flex-shrink: 0;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--td-brand-color);
      }

      .contentName {
        color: var(--td-text-color-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .contentLen {
        flex-shrink: 0;
        font-size: 12px;
        color: var(--td-text-color-placeholder);
      }
    }
  }
}

// 注意：菜单内容由 t-popup teleport 到 body，必须用顶层规则（不能嵌套在 .aiProjectChat 内），
// 否则 scoped 选择器不匹配，hover 手型/高亮全部失效
.settingMenu {
  padding: 4px 0;

  .settingMenuItem {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 16px;
    font-size: 14px;
    cursor: pointer;
    white-space: nowrap;

    &:hover {
      background-color: var(--td-bg-color-container-hover);
    }

    &.active {
      color: var(--td-brand-color);
    }

    &.danger {
      color: var(--td-error-color);
    }
  }
}
</style>
