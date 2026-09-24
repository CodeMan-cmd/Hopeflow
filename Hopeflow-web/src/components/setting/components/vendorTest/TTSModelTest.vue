<template>
  <t-dialog
    placement="center"
    width="52vw"
    v-model:visible="visible"
    :header="$t('settings.vendor.test.ttsTitle') + ' - ' + modelName"
    :footer="false"
    @closed="handleClose">
    <div class="ttsTestDialog">
      <!-- 文本输入 -->
      <t-form-item :label="$t('settings.vendor.test.text')">
        <t-textarea
          v-model="text"
          :placeholder="$t('settings.vendor.test.ttsTextPlaceholder')"
          :autosize="{ minRows: 3, maxRows: 6 }"
          :disabled="loading" />
      </t-form-item>

      <!-- 参考音频上传 -->
      <t-form-item :label="$t('settings.vendor.test.referenceAudio')">
        <div class="uploadRow">
          <AudioUploadBox v-model="audioFile" :label="$t('settings.vendor.test.uploadReferenceAudio')" />
          <p class="uploadHint">{{ $t("settings.vendor.test.referenceAudioHint") }}</p>
        </div>
      </t-form-item>

      <!-- 结果区 -->
      <div v-if="resultUrl" class="resultSection">
        <div class="resultLabel">{{ $t("settings.vendor.test.result") }}</div>
        <div class="resultAudio">
          <audio :src="resultUrl" controls style="width: 100%" />
        </div>
      </div>
      <div v-else-if="loading" class="loadingSection">
        <t-loading size="large" :text="$t('settings.vendor.generating')" />
      </div>

      <!-- 底部操作 -->
      <div class="dialogFooter">
        <t-button variant="outline" @click="visible = false">{{ $t("settings.vendor.test.cancel") }}</t-button>
        <t-button theme="primary" :loading="loading" :disabled="!canSubmit" @click="handleTest">
          <template #icon><i-lightning theme="outline" /></template>
          {{ $t("settings.vendor.test.startTest") }}
        </t-button>
      </div>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
import AudioUploadBox from "./AudioUploadBox.vue";

const visible = defineModel<boolean>("modelVisible");

const props = defineProps<{
  vendorId: string;
  modelName: string;
}>();

const text = ref("");
const audioFile = ref<File | null>(null);
const loading = ref(false);
const resultUrl = ref("");

const canSubmit = computed(() => !!text.value.trim() && !!audioFile.value && !loading.value);

const fileToDataURL = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string); // data:audio/...;base64,xxxx
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

async function handleTest() {
  if (!audioFile.value) return;
  loading.value = true;
  resultUrl.value = "";
  try {
    const referenceBase64 = await fileToDataURL(audioFile.value);
    const { data } = await axios.post(
      "/setting/vendorConfig/modelTest/ttsTest",
      {
        modelName: props.modelName,
        id: props.vendorId,
        text: text.value.trim(),
        referenceBase64,
      },
      { silent: true },
    );
    resultUrl.value = data;
    window.$message.success($t("settings.vendor.msg.ttsGenSuccess"));
  } catch (e: any) {
    window.$message.error(e.message ?? `${$t("settings.vendor.msg.requestFailed")}`);
  } finally {
    loading.value = false;
  }
}

function handleClose() {
  text.value = "";
  audioFile.value = null;
  resultUrl.value = "";
  loading.value = false;
}
</script>

<style lang="scss" scoped>
.ttsTestDialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 4px;

  .uploadRow {
    display: flex;
    align-items: center;
    gap: 12px;

    .uploadHint {
      font-size: 12px;
      color: var(--td-text-color-placeholder);
      margin: 0;
      flex: 1;
    }
  }

  .resultSection {
    .resultLabel {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--td-text-color-secondary);
    }

    .resultAudio {
      display: flex;
      background: var(--td-bg-color-component);
      border-radius: 8px;
      padding: 12px;
    }
  }

  .loadingSection {
    display: flex;
    justify-content: center;
    padding: 32px 0;
  }

  .dialogFooter {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    border-top: 1px solid var(--td-component-border);
    padding-top: 12px;
  }
}
</style>
