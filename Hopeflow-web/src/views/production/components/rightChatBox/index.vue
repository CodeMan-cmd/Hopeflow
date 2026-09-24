<template>
  <div class="rightChatBox" :style="{ width: boxWidth + 'px' }">
    <div ref="resizeHandleRef" class="resizeHandle"></div>
    <div class="header f ac jb">
      <span class="text">
        <i-dot theme="outline" :fill="connected ? 'green' : 'red'" />
        {{ props.title }}
      </span>
      <div class="close">
        <i-click-to-fold size="18" @click.stop="emit('close')" />
      </div>
    </div>
    <div class="chatBox" v-loading="loadingHistory">
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
        allowContentSegmentCustom>
        <template #actionbar v-if="message.role === 'assistant'">
          <div class="msgActions f ac" v-if="message.status !== 'pending' && message.status !== 'streaming'">
            <t-tooltip :content="$t('workbench.production.chatBox.replay')" placement="top" :showArrow="false">
              <i-refresh class="msgActionIcon" size="15" @click="handleReplay(message)" />
            </t-tooltip>
            <t-tooltip :content="$t('workbench.production.chatBox.copy')" placement="top" :showArrow="false">
              <i-copy class="msgActionIcon" size="15" @click="handleCopy(message)" />
            </t-tooltip>
          </div>
        </template>
      </t-chat-message>
    </t-chat-list>
    <div class="errorBanner f ac jb" v-if="errorMsg">
      <span class="f ac" style="gap: 6px; min-width: 0">
        <i-error class="errorIcon" size="16" />
        <span class="errorText">{{ errorMsg }}</span>
      </span>
      <t-button size="small" variant="outline" @click="handleRetryLast">
        <template #icon><i-refresh size="14" /></template>
        {{ $t("workbench.production.chatBox.replay") }}
      </t-button>
    </div>
    <div class="disconnectBar f ac" v-if="!connected">
      <i-close-wifi size="14" />
      <span class="flex1" style="flex: 1">{{ $t("workbench.production.chatBox.disconnected") }}</span>
      <span class="reconnectText" @click="handleReconnect">{{ $t("workbench.production.chatBox.reconnect") }}</span>
    </div>
    <t-chat-sender
        class="inputBox"
        :disabled="status === 'pending' || status === 'streaming' || !connected"
        v-model="inputValue"
        :loading="status === 'pending' || status === 'streaming'"
        :placeholder="$t('workbench.production.chatBox.inputPlaceholder')"
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
                    <span>{{ $t("workbench.scriptAgent.reconnect") }}</span>
                  </div>
                  <div class="settingMenuItem" @click="handleClearMemory('message')">
                    <i-delete size="14" />
                    <span>{{ $t("workbench.production.chatBox.clearMessageMemory") }}</span>
                  </div>
                  <div class="settingMenuItem" @click="handleClearMemory('summary')">
                    <i-close size="14" />
                    <span>{{ $t("workbench.production.chatBox.clearSummaryMemory") }}</span>
                  </div>
                  <div class="settingMenuItem danger" @click="handleClearMemory('all')">
                    <i-delete-one size="14" />
                    <span>{{ $t("workbench.production.chatBox.clearAllMemory") }}</span>
                  </div>
                </div>
              </template>
            </t-popup>
            <t-popup trigger="click" placement="top" v-if="showThink">
              <t-button size="small" variant="outline" :theme="['default', 'success', 'warning', 'danger'][thinkLevel] || 'default'">
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
                    @click="productionAgentStore().updateThinkConfig(opt.value)">
                    <span>{{ opt.label }}</span>
                  </div>
                </div>
              </template>
            </t-popup>
            <!--
              全自动开关：原来外层按钮只负责开合气泡，真正的开关藏在小字菜单里，
              按钮颜色也不随状态变化，很容易点了半天其实什么都没开。
              现在改成一次点击直接切换，并用「填充色 + 状态标签」把开关状态说清楚。
            -->
            <t-tooltip :content="$t('workbench.production.chatBox.autoModeDesc')" placement="top">
              <t-button
                size="small"
                :variant="autoMode ? 'base' : 'outline'"
                :theme="autoMode ? 'success' : 'default'"
                @click="handleToggleAutoMode">
                <template #icon>
                  <i-play-cycle size="16" />
                </template>
                <span>{{ $t("workbench.production.chatBox.autoMode") }}</span>
                <t-tag size="small" :theme="autoMode ? 'success' : 'default'" variant="light" style="margin-left: 6px">
                  {{ autoMode ? $t("workbench.production.chatBox.autoModeStateOn") : $t("workbench.production.chatBox.autoModeStateOff") }}
                </t-tag>
              </t-button>
            </t-tooltip>
          </div>
        </template>
      </t-chat-sender>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMousePressed, useMouse } from "@vueuse/core";
import _ from "lodash";
import axios from "@/utils/axios";
import productionAgentStore from "@/stores/productionAgent";
import projectStore from "@/stores/project";
const { project } = storeToRefs(projectStore());
const { connected, messages, status, episodesId, loadingHistory, thinkLevel, autoMode } = storeToRefs(productionAgentStore());
const thinkLevelOptions = [
  { label: $t("workbench.scriptAgent.thinkLevel.off"), value: 0 },
  { label: $t("workbench.scriptAgent.thinkLevel.light"), value: 1 },
  { label: $t("workbench.scriptAgent.thinkLevel.deep"), value: 2 },
  { label: $t("workbench.scriptAgent.thinkLevel.extreme"), value: 3 },
];

const props = defineProps({ title: String });

const emit = defineEmits(["close"]);

const inputValue = ref("");

function handleSend(text: string) {
  productionAgentStore().chat(text);
  inputValue.value = "";
}
function handleStop() {
  productionAgentStore().stopGenerate();
}

// 全自动模式开关：开启后 Agent 自动连续执行六阶段流水线
function handleToggleAutoMode() {
  const next = !autoMode.value;
  productionAgentStore().updateAutoConfig(next);
  if (next) {
    window.$message.success($t("workbench.production.chatBox.autoModeOn"));
  } else {
    window.$message.info($t("workbench.production.chatBox.autoModeOff"));
  }
}
function handleReconnect() {
  const dialog = DialogPlugin.confirm({
    header: $t("workbench.scriptAgent.msg.reconnect"),
    body: $t("workbench.scriptAgent.msg.notReconnect"),
    confirmBtn: $t("workbench.scriptAgent.msg.keepReconnect"),
    cancelBtn: $t("workbench.scriptAgent.msg.cancel"),
    theme: "warning",
    onConfirm: async () => {
      productionAgentStore().reconnect();
      dialog.destroy();
    },
  });
}

//快捷发送
const handleActions = {
  suggestion: (data?: any) => {
    console.log("[suggestion] clicked, data:", data);
    console.log("[suggestion] prompt:", data?.content?.prompt);
    console.log("[suggestion] connected:", connected.value);
    const result = productionAgentStore().chat(data?.content?.prompt);
    console.log("[suggestion] chat result:", result);
  },
};

// 消息操作：重新生成 / 复制
function extractMessageText(message: any): string {
  const content = message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((c: any) => c?.type === "text" && typeof c.data === "string")
      .map((c: any) => c.data)
      .join("\n");
  }
  return "";
}

function handleReplay(message: any) {
  productionAgentStore().regenerate(message?.id);
}

async function handleCopy(message: any) {
  const text = extractMessageText(message);
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    window.$message.success($t("workbench.production.chatBox.copied"));
  } catch (e) {
    window.$message.error($t("workbench.production.chatBox.copyFailed"));
  }
}

// 发送失败错误条：最后一条助手消息为 error 时展示，可一键重试
const errorMsg = ref("");
watch(
  () => messages.value[messages.value.length - 1]?.status,
  (status, oldStatus) => {
    if (status === "error") {
      errorMsg.value = $t("workbench.production.chatBox.errorHint");
    } else if (status === "pending" || status === "streaming" || status === "complete" || status === "stop") {
      errorMsg.value = "";
    }
  },
  { immediate: true },
);

function handleRetryLast() {
  const last = [...messages.value].reverse().find((m) => m.role === "assistant");
  if (last) {
    errorMsg.value = "";
    productionAgentStore().regenerate(last.id);
  }
}

const memoryTypeLabel: Record<string, string> = {
  message: $t("workbench.production.chatBox.messageMemory"),
  summary: $t("workbench.production.chatBox.summaryMemory"),
  all: $t("workbench.production.chatBox.allMemory"),
};
function handleClearMemory(type: "message" | "summary" | "all") {
  const dialog = DialogPlugin.confirm({
    header: $t("workbench.production.chatBox.confirmClear"),
    body: $t("workbench.production.chatBox.confirmClearBody", { type: memoryTypeLabel[type] }),
    confirmBtn: $t("workbench.production.chatBox.confirmClearBtn"),
    cancelBtn: $t("workbench.production.cancel"),
    theme: "warning",
    onConfirm: async () => {
      await axios.post(`/agents/clearMemory`, { projectId: project.value?.id, agentType: "productionAgent", episodesId: episodesId.value, type });
      window.$message.success($t("workbench.production.chatBox.memoryCleared", { type: memoryTypeLabel[type] }));
      dialog.destroy();
      productionAgentStore().getHistory();
    },
  });
}

const resizeHandleRef = ref<HTMLElement | null>(null);
const boxWidth = ref(400);
const MIN_WIDTH = 400;
const { pressed } = useMousePressed({ target: resizeHandleRef });
const { x } = useMouse();
const dragStartX = ref(0);
const dragStartWidth = ref(400);
watch(pressed, (isPressed) => {
  if (isPressed) {
    dragStartX.value = x.value;
    dragStartWidth.value = boxWidth.value;
  }
});
watchEffect(() => {
  if (pressed.value) {
    const maxWidth = window.innerWidth * 0.8;
    boxWidth.value = Math.min(maxWidth, Math.max(MIN_WIDTH, dragStartWidth.value + (dragStartX.value - x.value)));
  }
});

const showThink = ref(false);
onMounted(async () => {
  try {
    const { data } = await axios.post(`/project/getModelDetails`, { key: "productionAgent" });
    if (data && data.think) {
      showThink.value = true;
    }
  } catch {}
});
watch(connected, (newVal) => {
  if (status.value != "idle" && newVal) {
    status.value = "idle";
  }
});
</script>

<style lang="scss" scoped>
.rightChatBox {
  position: absolute;
  top: 10px;
  right: 0;
  bottom: 10px;
  display: flex;
  flex-direction: column;
  z-index: 9999;
  min-width: 400px;
  height: calc(100% - 20px);
  margin-right: 5px;
  border-radius: 10px;
  border: 1px solid var(--td-border-level-1-color);
  background-color: var(--td-bg-color-container);
  overflow-y: auto;

  .resizeHandle {
    user-select: none;
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    cursor: col-resize;
    z-index: 10;
    &:hover {
      background-color: var(--td-bg-color-container-hover);
    }
  }
  box-shadow: -4px 2px 10px var(--td-shadow-1);
  .chatBox {
    width: 100%;
    height: calc(100% - 50px);
    display: flex;
    flex-direction: column;
    padding-left: 8px;
    .inputBox {
      padding-right: 8px;
    }
  }
  :deep(.t-chat__list) {
    padding-right: 8px;
  }
  .msgActions {
    gap: 10px;
    .msgActionIcon {
      cursor: pointer;
      color: var(--td-text-color-placeholder);
      transition: color 0.2s;
      &:hover {
        color: var(--td-brand-color);
      }
    }
  }
  .errorBanner {
    flex-shrink: 0;
    margin: 0 8px 6px;
    padding: 6px 10px;
    gap: 8px;
    border-radius: var(--td-radius-medium);
    background: var(--td-error-color-1, #fff0ed);
    border: 1px solid var(--td-error-color-3, #ffb9b0);
    .errorIcon {
      color: var(--td-error-color);
      flex-shrink: 0;
    }
    .errorText {
      font-size: 12px;
      color: var(--td-error-color);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
  .disconnectBar {
    flex-shrink: 0;
    margin: 0 8px 6px;
    padding: 4px 10px;
    gap: 6px;
    font-size: 12px;
    border-radius: var(--td-radius-medium);
    color: var(--td-warning-color);
    background: var(--td-warning-color-1, #fff1e9);
    .reconnectText {
      cursor: pointer;
      text-decoration: underline;
      flex-shrink: 0;
    }
  }
  .header {
    height: 40px;
    line-height: 40px;
    padding: 0 10px;
    flex-shrink: 0;
    .text {
      font-size: 18px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
    }
    .close {
      cursor: pointer;
      aspect-ratio: 1/1;
    }
  }
}

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
    &.danger {
      color: var(--td-error-color);
    }
  }
  .settingMenuDesc {
    padding: 2px 16px 6px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--td-text-color-placeholder);
    max-width: 240px;
  }
}
.modelSelCls {
  gap: 5px;
  .paramSelect {
    max-width: 80px;
  }
}
</style>
