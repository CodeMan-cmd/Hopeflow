<template>
  <t-dialog
    v-model:visible="addAssetsShow"
    :closable="false"
    width="40vw"
    :header="props.formData.id ? '编辑' : '新增'"
    :maskClosable="false"
    @close-btn-click="handleCancel"
    @confirm="onConfirm"
    @cancel="handleCancel">
    <div class="data">
      <t-form :data="props.formData" :rules="rules" ref="formRef">
        <t-form-item :label="$t('workbench.assets.add.audioName')" name="name">
          <t-input v-model="props.formData.name" :placeholder="$t('workbench.assets.add.audioNamePh')"></t-input>
        </t-form-item>
        <t-form-item :label="$t('workbench.assets.add.describe')" name="describe">
          <t-textarea v-model="props.formData.describe" :placeholder="$t('workbench.assets.add.describePh')"></t-textarea>
        </t-form-item>
        <t-form-item :label="$t('workbench.assets.add.sex')" name="remark">
          <t-input v-model="props.formData.sex" :placeholder="$t('workbench.assets.add.sexPh')"></t-input>
        </t-form-item>
        <t-form-item :label="$t('workbench.assets.add.audioFile')" name="audioFile">
          <div class="audio-list">
            <t-button theme="primary" variant="outline" size="small" style="align-self: flex-start" @click="openTTSDialog">
              <template #icon><i-lightning /></template>
              {{ $t("workbench.assets.add.aiDubbing") }}
            </t-button>
            <div v-for="(item, index) in audioItems" :key="index" class="audio-item">
              <div class="audio-upload-row">
                <div class="audio-file-area" @click="triggerFileInput(index)" @dragover.prevent @drop.prevent="(e) => handleDrop(e, index)">
                  <template v-if="item.file">
                    <i-volume-notice size="16" />
                    <span class="audio-filename">{{ item.file.name }}</span>
                  </template>
                  <template v-else-if="item.src">
                    <i-volume-notice size="16" fill="var(--td-success-color)" />
                    <span class="audio-filename audio-filename--existing">{{ item.name }}</span>
                    <t-tag size="small" theme="success" variant="light" style="margin-left: auto; flex-shrink: 0">已上传</t-tag>
                  </template>
                  <template v-else>
                    <i-upload-one size="16" fill="var(--td-brand-color)" />
                    <span class="audio-upload-hint">点击或拖拽上传音频</span>
                  </template>
                  <input
                    :ref="(el) => (fileInputRefs[index] = el as HTMLInputElement)"
                    type="file"
                    accept="audio/*"
                    style="display: none"
                    @change="(e) => handleFileChange(e, index)" />
                </div>
                <t-button theme="danger" variant="outline" shape="circle" size="small" @click="removeAudioItem(index)">
                  <template #icon><i-close size="12" /></template>
                </t-button>
              </div>
              <t-input v-model="item.text" placeholder="请输入该音频对应的文本内容" class="audio-text-input" />
              <t-input v-model="item.describe" placeholder="请输入该音频的描述" class="audio-text-input" />
            </div>
            <t-button theme="primary" variant="outline" size="small" @click="addAudioItem">
              <template #icon><i-plus /></template>
              添加音频
            </t-button>
          </div>
        </t-form-item>
      </t-form>
    </div>
  </t-dialog>

  <!-- AI 配音生成弹窗 -->
  <t-dialog
    :closeBtn="true"
    :footer="false"
    v-model:visible="ttsDialogVisible"
    width="520px"
    :header="$t('workbench.assets.add.aiDubbing')">
    <div class="ttsGen">
      <t-form-item :label="$t('workbench.assets.add.ttsModel')">
        <modelSelect v-model="ttsModel" :type="`tts`" />
      </t-form-item>
      <t-form-item :label="$t('workbench.assets.add.ttsText')">
        <t-textarea
          v-model="ttsText"
          :autosize="{ minRows: 3, maxRows: 6 }"
          :placeholder="$t('workbench.assets.add.ttsTextPh')"
          :disabled="ttsLoading" />
      </t-form-item>
      <t-form-item :label="$t('workbench.assets.add.ttsReference')">
        <div class="ttsRefRow">
          <AudioUploadBox v-model="ttsRefFile" :label="$t('workbench.assets.add.ttsReferencePh')" />
          <span class="ttsRefHint">{{ $t("settings.vendor.test.referenceAudioHint") }}</span>
        </div>
      </t-form-item>
      <div class="ttsFooter">
        <t-button variant="outline" @click="ttsDialogVisible = false">{{ $t("workbench.assets.cancelBtn") }}</t-button>
        <t-button theme="primary" :loading="ttsLoading" :disabled="!ttsText.trim() || !ttsRefFile" @click="handleTTSGenerate">
          <template #icon><i-lightning /></template>
          {{ $t("workbench.assets.add.ttsGenerate") }}
        </t-button>
      </div>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
import projectStore from "@/stores/project";
import modelSelect from "@/components/modelSelect.vue";
import AudioUploadBox from "@/components/setting/components/vendorTest/AudioUploadBox.vue";
const { project } = storeToRefs(projectStore());

interface AudioItem {
  id?: number;
  src?: string;
  file: File | null;
  text: string;
  name: string;
  describe: string;
}
const props = defineProps<{
  formData: {
    id?: number;
    name: string;
    describe: string;
    sex: string;
    sonAssets?: {
      id?: number;
      src?: string;
      prompt: string;
      name?: string;
      describe?: string;
    }[];
  };
}>();
const addAssetsShow = defineModel<boolean>({
  default: false,
});
const rules = ref<{}>({
  name: [{ required: true, message: $t("workbench.assets.add.nameRequired"), trigger: "blur" }],
  describe: [{ required: true, message: $t("workbench.assets.add.describeRequired"), trigger: "blur" }],
});
function handleCancel() {
  addAssetsShow.value = false;
  // 重置音频列表
  audioItems.value = [{ file: null, text: "", name: "", describe: "" }];
}
const formRef = ref();
const emit = defineEmits(["getFilteredData"]);

const audioItems = ref<AudioItem[]>([{ file: null, text: "", name: "", describe: "" }]);
const fileInputRefs = ref<HTMLInputElement[]>([]);

// 初始化音频列表
watch(
  () => props.formData.sonAssets,
  (newSonAssets) => {
    if (newSonAssets && newSonAssets.length > 0) {
      audioItems.value = newSonAssets.map((asset) => ({
        id: asset.id,
        src: asset.src,
        file: null,
        text: asset.prompt,
        name: asset.name || "",
        describe: asset.describe || "",
      }));
    } else {
      audioItems.value = [{ file: null, text: "", name: "", describe: "" }];
    }
  },
  { immediate: true },
);

function addAudioItem() {
  audioItems.value.push({ file: null, text: "", name: "", describe: "" });
}

function removeAudioItem(index: number) {
  audioItems.value.splice(index, 1);
  if (audioItems.value.length === 0) {
    audioItems.value.push({ file: null, text: "", name: "", describe: "" });
  }
}

function triggerFileInput(index: number) {
  fileInputRefs.value[index]?.click();
}

function handleFileChange(e: Event, index: number) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    audioItems.value[index].file = file;
    audioItems.value[index].src = undefined;
    if (!audioItems.value[index].name) {
      audioItems.value[index].name = file.name;
    }
  }
  input.value = "";
}

function handleDrop(e: DragEvent, index: number) {
  const file = e.dataTransfer?.files?.[0];
  if (file && file.type.startsWith("audio/")) {
    audioItems.value[index].file = file;
    if (!audioItems.value[index].name) {
      audioItems.value[index].name = file.name;
    }
  } else if (file) {
    window.$message.warning($t("workbench.assets.add.pleaseUploadAudio"));
  }
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── AI 配音生成 ──
const ttsDialogVisible = ref(false);
const ttsModel = ref("");
const ttsText = ref("");
const ttsRefFile = ref<File | null>(null);
const ttsLoading = ref(false);

function openTTSDialog() {
  ttsDialogVisible.value = true;
  ttsModel.value = "";
  ttsText.value = "";
  ttsRefFile.value = null;
}

async function handleTTSGenerate() {
  if (!ttsModel.value) {
    window.$message.warning($t("workbench.assets.add.ttsModelRequired"));
    return;
  }
  if (!ttsRefFile.value) {
    window.$message.warning($t("workbench.assets.add.ttsReferenceRequired"));
    return;
  }
  ttsLoading.value = true;
  try {
    const referenceBase64 = await fileToBase64(ttsRefFile.value);
    const { data } = await axios.post(
      "/assets/generateTTS",
      {
        projectId: project.value?.id ?? 0,
        model: ttsModel.value,
        text: ttsText.value.trim(),
        referenceBase64,
      },
      { silent: true },
    );
    if (data.state === "待下载") {
      // 服务端下载受限，引导浏览器下载后回传
      window.$message.warning($t("workbench.assets.add.ttsNeedDownload"));
      window.open(data.url, "_blank");
    } else {
      audioItems.value.push({
        id: undefined,
        src: data.src,
        file: null,
        text: ttsText.value.trim(),
        name: data.name || `AI配音-${ttsText.value.trim().slice(0, 10)}`,
        describe: "",
      });
      window.$message.success($t("workbench.assets.add.ttsSuccess"));
    }
    ttsDialogVisible.value = false;
  } catch (e: any) {
    window.$message.error(e?.message ?? $t("workbench.assets.add.ttsFailed"));
  } finally {
    ttsLoading.value = false;
  }
}

function onConfirm() {
  formRef.value?.validate().then(async (result: any) => {
    if (result == true) {
      const assetsItem = (
        await Promise.all(
          audioItems.value.map(async (item) => {
            if (item.id != null && item.src) {
              return {
                id: item.id,
                src: item.src,
                prompt: item.text || "",
                name: item.name || item.src.split("/").pop() || "",
                describe: item.describe || "",
              };
            }
            if (item.file) {
              return {
                base64: await fileToBase64(item.file),
                prompt: item.text || "",
                name: item.name || item.file.name,
                describe: item.describe || "",
              };
            }
            return null;
          }),
        )
      ).filter(
        (
          item,
        ): item is
          | { id: number; src: string; prompt: string; name: string; describe: string }
          | { base64: string; prompt: string; name: string; describe: string } => !!item,
      );

      const payload = {
        name: props.formData.name,
        describe: props.formData.sex + "|" + props.formData.describe,
        projectId: project.value?.id ?? 0,
        assetsItem,
      };
      console.log(props.formData.id);
      if (props.formData.id) {
        await axios
          .post(`/assets/updateAudioAssets`, {
            id: props.formData.id,
            ...payload,
          })
          .then(() => {
            window.$message.success($t("workbench.assets.add.updateSuccess"));
            emit("getFilteredData");
            addAssetsShow.value = false;
          });
      } else {
        await axios.post(`/assets/addAudioAssets`, payload).then(() => {
          window.$message.success($t("workbench.assets.add.addSuccess"));
          emit("getFilteredData");
          addAssetsShow.value = false;
        });
      }
    }
  });
}
</script>

<style lang="scss" scoped>
.modalHeader {
  background: var(--td-bg-color-container);
  width: 100%;

  :deep(.ant-typography) {
    color: var(--td-text-color-primary);
    margin: 0;
  }

  :deep(.ant-btn-text) {
    color: var(--td-brand-color);

    &:hover {
      background: var(--td-bg-color-component-hover);
      color: var(--td-brand-color-hover);
    }
  }
}

.data {
  width: 100%;
}

.audio-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;

  .audio-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    border: 1px solid var(--td-border-level-1-color);
    border-radius: 6px;
    background: var(--td-bg-color-secondarycontainer);

    .audio-upload-row {
      display: flex;
      align-items: center;
      gap: 8px;

      .audio-file-area {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border: 1px dashed var(--td-component-border);
        border-radius: 4px;
        cursor: pointer;
        min-height: 34px;
        transition: border-color 0.2s;

        &:hover {
          border-color: var(--td-brand-color);
          background: var(--td-bg-color-secondarycontainer-hover);
        }

        .audio-filename {
          font-size: 14px;
          color: var(--td-text-color-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 200px;
          flex: 1;

          &--existing {
            color: var(--td-success-color);
          }
        }

        .audio-upload-hint {
          font-size: 12px;
          color: var(--td-text-color-placeholder);
        }
      }
    }

    .audio-text-input {
      width: 100%;
    }
  }
}

.ttsGen {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .ttsRefRow {
    display: flex;
    align-items: center;
    gap: 12px;

    .ttsRefHint {
      font-size: 12px;
      color: var(--td-text-color-placeholder);
      flex: 1;
    }
  }

  .ttsFooter {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    border-top: 1px solid var(--td-component-border);
    padding-top: 12px;
  }
}
</style>
