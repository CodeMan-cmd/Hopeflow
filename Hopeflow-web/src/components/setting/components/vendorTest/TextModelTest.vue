<template>
  <t-dialog
    placement="center"
    width="60vw"
    v-model:visible="visible"
    :header="$t('settings.vendor.test.textTitle') + ' - ' + modelName"
    :footer="false"
    @closed="handleClose">
    <div class="textTestDialog">
      <!-- 消息列表 -->
      <div class="messageList" ref="messageListRef">
        <div v-if="messages.length === 0" class="emptyHint">
          {{ $t("settings.vendor.test.textEmptyHint") }}
        </div>
        <div v-for="(msg, idx) in messages" :key="idx" class="messageItem" :class="msg.role">
          <div class="bubble">
            <div class="role">
              {{ msg.role === "user" ? $t("settings.vendor.test.you") : $t("settings.vendor.test.assistant") }}
            </div>
            <div class="content" v-if="msg.role === 'assistant'">
              <span v-if="msg.thinking" class="thinkContent">
                <i-thinking-problem theme="outline" size="14" />
                {{ msg.thinking }}
              </span>
              <span>{{ msg.content }}</span>
              <span v-if="msg.loading" class="cursor">▌</span>
            </div>
            <div class="content" v-else>{{ msg.content }}</div>
          </div>
        </div>
      </div>
      <!-- 输入区域 -->
      <div class="inputArea">
        <t-textarea
          v-model="inputText"
          :placeholder="$t('settings.vendor.test.textInputPlaceholder')"
          :autosize="{ minRows: 2, maxRows: 5 }"
          :disabled="loading"
          @keydown.enter.ctrl.exact="handleSend" />
        <div class="inputActions">
          <span class="hint">Ctrl + Enter {{ $t("settings.vendor.test.send") }}</span>
          <div class="btns">
            <t-button variant="outline" size="small" :disabled="loading || messages.length === 0" @click="handleClear">
              {{ $t("settings.vendor.test.clearHistory") }}
            </t-button>
            <t-button theme="primary" size="small" :loading="loading" :disabled="!inputText.trim()" @click="handleSend">
              <template #icon><i-send theme="outline" /></template>
              {{ $t("settings.vendor.test.send") }}
            </t-button>
          </div>
        </div>
      </div>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";

const props = defineProps<{
  vendorId: string;
  modelName: string;
}>();
const visible = defineModel<boolean>("modelVisible");

interface Message {
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  loading?: boolean;
}

const messages = ref<Message[]>([]);
const inputText = ref("");
const loading = ref(false);
const messageListRef = ref<HTMLDivElement | null>(null);

function scrollToBottom() {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight;
    }
  });
}

async function handleSend() {
  const text = inputText.value.trim();
  if (!text || loading.value) return;

  messages.value.push({ role: "user", content: text });
  inputText.value = "";
  loading.value = true;

  const assistantMsg: Message = { role: "assistant", content: "", loading: true };
  messages.value.push(assistantMsg);
  scrollToBottom();

  try {
    const history = messages.value.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));

    const { data } = await axios.post("/setting/vendorConfig/modelTest/textTest", {
      modelName: props.modelName,
      id: props.vendorId,
      messages: history,
    });

    assistantMsg.content = typeof data === "string" ? data : (data?.content ?? JSON.stringify(data));
    assistantMsg.thinking = data?.thinking ?? undefined;
    assistantMsg.loading = false;
  } catch (e: any) {
    const errMsg = e?.response?.data?.message || e?.response?.data || e?.message || String(e);
    assistantMsg.content = `❌ ${typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg)}`;
    assistantMsg.loading = false;
  } finally {
    loading.value = false;
    scrollToBottom();
  }
}

function handleClear() {
  messages.value = [];
}

function handleClose() {
  messages.value = [];
  inputText.value = "";
  loading.value = false;
}
</script>

<style lang="scss" scoped>
.textTestDialog {
  display: flex;
  flex-direction: column;
  height: 65vh;

  .messageList {
    flex: 1;
    overflow-y: auto;
    padding: 12px 4px;
    display: flex;
    flex-direction: column;
    gap: 12px;

    .emptyHint {
      text-align: center;
      color: var(--td-text-color-placeholder);
      margin-top: 80px;
      font-size: 14px;
    }

    .messageItem {
      display: flex;

      &.user {
        justify-content: flex-end;
        .bubble {
          background: var(--td-brand-color);
          color: #fff;
          border-radius: 12px 12px 2px 12px;
          .role {
            color: rgba(255, 255, 255, 0.75);
          }
        }
      }

      &.assistant {
        justify-content: flex-start;
        .bubble {
          background: var(--td-bg-color-container-hover);
          border-radius: 12px 12px 12px 2px;
        }
      }

      .bubble {
        max-width: 78%;
        padding: 10px 14px;
        font-size: 14px;
        line-height: 1.6;

        .role {
          font-size: 12px;
          font-weight: 600;
          opacity: 0.6;
          margin-bottom: 4px;
        }

        .content {
          white-space: pre-wrap;
          word-break: break-word;

          .thinkContent {
            display: block;
            font-size: 12px;
            color: var(--td-text-color-secondary);
            background: var(--td-bg-color-secondarycontainer);
            border-left: 3px solid var(--td-brand-color-light);
            padding: 4px 8px;
            margin-bottom: 6px;
            border-radius: 0 4px 4px 0;
          }
        }

        .cursor {
          animation: blink 1s step-end infinite;
        }
      }
    }
  }

  .inputArea {
    border-top: 1px solid var(--td-component-border);
    padding-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;

    .inputActions {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .hint {
        font-size: 12px;
        color: var(--td-text-color-placeholder);
      }

      .btns {
        display: flex;
        gap: 8px;
      }
    }
  }
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}
</style>
