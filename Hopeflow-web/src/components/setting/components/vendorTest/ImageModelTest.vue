<template>
  <t-dialog
    placement="center"
    width="56vw"
    v-model:visible="visible"
    :header="$t('settings.vendor.test.imageTitle') + ' - ' + modelName"
    :footer="false"
    @closed="handleClose">
    <div class="imageTestDialog">
      <!-- 模式选择 -->
      <div class="modeBar">
        <t-radio-group v-model="testMode" variant="default-filled">
          <t-radio-button v-for="m in availableModes" :key="m.value" :value="m.value">{{ m.label }}</t-radio-button>
        </t-radio-group>
      </div>

      <!-- 输入区 -->
      <div class="inputSection">
        <!-- 图生图：上传图片 -->
        <div v-if="testMode === 'singleImage'" class="uploadRow">
          <div class="uploadBox" @click="triggerImageUpload" @dragover.prevent @drop.prevent="handleDrop">
            <img v-if="imagePreview" :src="imagePreview" class="previewImg" alt="preview" />
            <template v-else>
              <i-picture theme="outline" size="32" fill="var(--td-brand-color)" />
              <p class="uploadText">{{ $t("settings.vendor.test.uploadImage") }}</p>
              <p class="uploadHint">{{ $t("settings.vendor.test.supportFormat") }}</p>
            </template>
          </div>
          <input ref="imageInputRef" type="file" accept="image/*" style="display: none" @change="handleImageChange" />
        </div>

        <t-form-item :label="$t('settings.vendor.test.prompt')">
          <t-textarea
            v-model="prompt"
            :placeholder="$t('settings.vendor.test.promptPlaceholder')"
            :autosize="{ minRows: 2, maxRows: 4 }"
            :disabled="loading" />
        </t-form-item>
      </div>

      <!-- 结果区 -->
      <div v-if="resultUrl" class="resultSection">
        <div class="resultLabel">{{ $t("settings.vendor.test.result") }}</div>
        <div class="resultImg">
          <img :src="resultUrl" alt="generated" />
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

type ImageMode = "text" | "singleImage" | "multiReference";
const visible = defineModel<boolean>("modelVisible");

const props = defineProps<{
  vendorId: string;
  modelName: string;
  /** 模型支持的 mode 列表 */
  supportedModes: ImageMode[];
}>();

const MODE_OPTIONS: { value: ImageMode; label: string }[] = [
  { value: "text", label: $t("settings.vendor.test.textToImage") },
  { value: "singleImage", label: $t("settings.vendor.test.imageToImage") },
  { value: "multiReference", label: $t("settings.vendor.test.multiRef") },
];

const availableModes = computed(() => MODE_OPTIONS.filter((m) => props.supportedModes.includes(m.value)));

const testMode = ref<ImageMode>("text");

watch(
  () => props.supportedModes,
  (modes) => {
    if (modes.length > 0 && !modes.includes(testMode.value)) {
      testMode.value = modes[0];
    }
  },
  { immediate: true },
);

watch(testMode, () => {
  imageFile.value = null;
  imagePreview.value = "";
  resultUrl.value = "";
});

const prompt = ref("");
const imageFile = ref<File | null>(null);
const imagePreview = ref("");
const imageInputRef = ref<HTMLInputElement | null>(null);
const loading = ref(false);
const resultUrl = ref("");

const canSubmit = computed(() => {
  if (loading.value) return false;
  if (testMode.value === "text") return !!prompt.value.trim();
  if (testMode.value === "singleImage" || testMode.value === "multiReference") return !!imageFile.value;
  return false;
});

function triggerImageUpload() {
  imageInputRef.value?.click();
}

function handleImageChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  imageFile.value = file;
  imagePreview.value = URL.createObjectURL(file);
  (e.target as HTMLInputElement).value = "";
}

function handleDrop(e: DragEvent) {
  const file = e.dataTransfer?.files?.[0];
  if (file && file.type.startsWith("image/")) {
    imageFile.value = file;
    imagePreview.value = URL.createObjectURL(file);
  }
}

const fileToDataURL = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string); // data:image/...;base64,xxxx
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
async function handleTest() {
  loading.value = true;
  resultUrl.value = "";
  try {
    const payload: Record<string, any> = {
      modelName: props.modelName,
      id: props.vendorId,
    };
    const p = prompt.value.trim();
    if (p) payload.prompt = p;
    if (imageFile.value) {
      payload.imageBase64 = await fileToDataURL(imageFile.value); // 带前缀 data:image/...;base64,
    }
    const { data } = await axios.post("/setting/vendorConfig/modelTest/imageTest", payload, { silent: true });
    resultUrl.value = data;
    window.$message.success($t("settings.vendor.msg.imageGenSuccess"));
  } catch (e: any) {
    window.$message.error(e.message ?? `${$t("settings.vendor.msg.requestFailed")}`);
  } finally {
    loading.value = false;
  }
}

function handleClose() {
  prompt.value = "";
  imageFile.value = null;
  imagePreview.value = "";
  resultUrl.value = "";
  loading.value = false;
}
</script>

<style lang="scss" scoped>
.imageTestDialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 4px;

  .modeBar {
    display: flex;
    justify-content: center;
  }

  .inputSection {
    display: flex;
    flex-direction: column;
    gap: 10px;

    .uploadRow {
      display: flex;
      justify-content: center;

      .uploadBox {
        width: 200px;
        height: 160px;
        border: 2px dashed var(--td-component-border);
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: border-color 0.2s;
        overflow: hidden;

        &:hover {
          border-color: var(--td-brand-color);
        }

        .previewImg {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .uploadText {
          font-size: 14px;
          margin: 0;
        }

        .uploadHint {
          font-size: 12px;
          color: var(--td-text-color-placeholder);
          margin: 0;
        }
      }
    }
  }

  .resultSection {
    .resultLabel {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--td-text-color-secondary);
    }

    .resultImg {
      display: flex;
      justify-content: center;
      background: var(--td-bg-color-component);
      border-radius: 8px;
      padding: 12px;
      max-height: 45vh;
      overflow: auto;

      img {
        max-width: 100%;
        max-height: 40vh;
        border-radius: 6px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
      }
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
