<template>
  <div class="characterSetting" v-loading="loading">
    <div class="header">
      <div class="headerActions f ac">
        <t-input v-model="keyword" clearable :placeholder="$t('workbench.character.searchPh')" style="width: 200px" @enter="loadList" />
        <t-button variant="outline" theme="primary" @click="openExtractDialog">
          <template #icon><i-copy :size="16" /></template>
          {{ $t("workbench.character.aiExtract") }}
        </t-button>
        <t-button theme="primary" @click="openGenerateDialog">
          <template #icon><i-magic :size="16" /></template>
          {{ $t("workbench.character.aiGenerate") }}
        </t-button>
        <t-button variant="outline" @click="openDialog()">
          <template #icon><i-add :size="16" /></template>
          {{ $t("workbench.character.add") }}
        </t-button>
      </div>
    </div>

    <div v-if="list.length" class="cardGrid">
      <t-card v-for="item in list" :key="item.id" class="charCard" hoverable>
        <div class="charHeader">
          <div class="avatarWrap" :style="{ background: avatarBg(item.id) }">{{ item.name?.slice(0, 1) || "?" }}</div>
          <div class="charName">
            <div class="name">{{ item.name }}</div>
            <t-tag v-if="item.gender" size="small" variant="light">{{ item.gender }}</t-tag>
          </div>
        </div>
        <div class="charBody">
          <div v-if="item.personality" class="charLine">
            <span class="charLabel">{{ $t("workbench.character.personality") }}</span>
            <span class="charText" :title="item.personality">{{ item.personality }}</span>
          </div>
          <div v-if="item.appearance" class="charLine">
            <span class="charLabel">{{ $t("workbench.character.appearance") }}</span>
            <span class="charText" :title="item.appearance">{{ item.appearance }}</span>
          </div>
          <div v-if="item.background" class="charLine">
            <span class="charLabel">{{ $t("workbench.character.background") }}</span>
            <span class="charText" :title="item.background">{{ item.background }}</span>
          </div>
          <div v-if="item.relations" class="charLine">
            <span class="charLabel">{{ $t("workbench.character.relations") }}</span>
            <span class="charText" :title="item.relations">{{ item.relations }}</span>
          </div>
          <div v-if="item.voiceDesc" class="charLine">
            <span class="charLabel">{{ $t("workbench.character.voice") }}</span>
            <span class="charText" :title="item.voiceDesc">{{ item.voiceDesc }}</span>
          </div>
        </div>
        <div class="charFooter">
          <t-button size="small" variant="text" theme="primary" @click="openOptimizeDialog(item)">
            <template #icon><i-magic :size="14" /></template>
            {{ $t("workbench.character.aiOptimize") }}
          </t-button>
          <t-button size="small" variant="outline" theme="primary" @click="openDialog(item)">
            <template #icon><i-edit :size="14" /></template>
            {{ $t("workbench.character.edit") }}
          </t-button>
          <t-popconfirm :content="$t('workbench.character.deleteConfirm')" @confirm="onDelete(item)">
            <t-button size="small" variant="text" theme="danger">
              <template #icon><i-delete :size="14" /></template>
              {{ $t("workbench.character.delete") }}
            </t-button>
          </t-popconfirm>
        </div>
      </t-card>
    </div>
    <AppEmpty v-else :title="$t('workbench.character.empty')">
      <template #action>
        <div class="emptyActions">
          <t-button theme="primary" @click="openDialog()">
            <template #icon><i-add :size="16" /></template>
            {{ $t("workbench.character.add") }}
          </t-button>
          <t-button variant="outline" @click="openGenerateDialog">
            <template #icon><i-magic :size="16" /></template>
            {{ $t("workbench.character.aiGenerate") }}
          </t-button>
        </div>
      </template>
    </AppEmpty>

    <!-- AI 生成弹窗 -->
    <t-dialog
      v-model:visible="genDialogVisible"
      :header="$t('workbench.character.aiGenerate')"
      width="480px"
      :confirm-btn="{ content: $t('workbench.character.aiGenerate'), loading: genLoading }"
      :cancel-btn="$t('common.cancel')"
      :confirm-on-enter="false"
      :on-confirm="onAiGenerate">
      <t-form label-align="top" :label-width="80">
        <t-form-item :label="$t('workbench.character.name')" required-mark>
          <t-input v-model="genForm.name" :placeholder="$t('workbench.character.aiGenerateNamePh')" />
        </t-form-item>
        <t-form-item :label="$t('workbench.character.aiGenerateDesc')" required-mark>
          <t-textarea v-model="genForm.description" :autosize="{ minRows: 3, maxRows: 5 }" :placeholder="$t('workbench.character.aiGenerateDescPh')" />
        </t-form-item>
        <t-form-item :label="$t('workbench.character.aiModel')" required-mark>
          <modelSelect v-model="genForm.model" type="text" :placeholder="$t('workbench.character.aiModelPh')" />
        </t-form-item>
      </t-form>
    </t-dialog>

    <!-- AI 优化弹窗 -->
    <t-dialog
      v-model:visible="optDialogVisible"
      :header="`${$t('workbench.character.aiOptimize')}：${optTarget?.name || ''}`"
      width="480px"
      :confirm-btn="{ content: $t('workbench.character.aiOptimize'), loading: optLoading }"
      :cancel-btn="$t('common.cancel')"
      :confirm-on-enter="false"
      :on-confirm="onAiOptimize">
      <t-form label-align="top" :label-width="80">
        <t-form-item :label="$t('workbench.character.aiModel')" required-mark>
          <modelSelect v-model="optForm.model" type="text" :placeholder="$t('workbench.character.aiModelPh')" />
        </t-form-item>
        <t-form-item :label="$t('workbench.character.aiOptimizeFocus')">
          <t-input v-model="optForm.focus" :placeholder="$t('workbench.character.aiOptimizeFocusPh')" />
        </t-form-item>
      </t-form>
    </t-dialog>

    <!-- 提取弹窗 -->
    <t-dialog
      v-model:visible="extractDialogVisible"
      :header="$t('workbench.character.aiExtract')"
      width="640px"
      :confirm-btn="null"
      :cancel-btn="$t('common.cancel')">
      <t-form label-align="top" :label-width="80">
        <div class="extractRow">
          <t-form-item :label="$t('workbench.character.aiExtractProject')" required-mark class="extractItem">
            <t-select v-model="extractForm.projectId" filterable :placeholder="$t('workbench.character.aiExtractProjectPh')">
              <t-option v-for="p in projectList" :key="p.id" :value="p.id" :label="p.name" />
            </t-select>
          </t-form-item>
          <t-form-item :label="$t('workbench.character.aiExtractSource')" required-mark class="extractItem">
            <t-radio-group v-model="extractForm.source" variant="default-filled">
              <t-radio-button value="novel">{{ $t("workbench.character.aiExtractNovel") }}</t-radio-button>
              <t-radio-button value="script">{{ $t("workbench.character.aiExtractScript") }}</t-radio-button>
            </t-radio-group>
          </t-form-item>
          <t-form-item :label="$t('workbench.character.aiModel')" required-mark class="extractItem">
            <modelSelect v-model="extractForm.model" type="text" :placeholder="$t('workbench.character.aiModelPh')" />
          </t-form-item>
        </div>
        <div class="extractActions">
          <t-button theme="primary" :loading="extractLoading" @click="onAiExtract">
            <template #icon><i-magic :size="16" /></template>
            {{ $t("workbench.character.aiExtractStart") }}
          </t-button>
          <t-button v-if="extractResult.length" :loading="batchSaving" @click="onBatchSave">
            {{ $t("workbench.character.batchSave") }}
          </t-button>
        </div>

        <t-divider />
        <div class="extractResult">
          <div class="resultTitle">{{ $t("workbench.character.aiExtractResult") }}</div>
          <t-empty v-if="!extractResult.length" :description="$t('workbench.character.aiExtractEmpty')" />
          <div v-else class="resultList">
            <t-checkbox-group v-model="extractSelected" class="resultChecks">
              <label v-for="item in extractResult" :key="item.name" class="resultItem">
                <t-checkbox :value="item.name" />
                <span class="resultName">{{ item.name }}</span>
                <span class="resultGender">{{ item.gender }}</span>
              </label>
            </t-checkbox-group>
          </div>
        </div>
      </t-form>
    </t-dialog>

    <!-- 新增/编辑弹窗（AI 结果预览复用此弹窗） -->
    <t-dialog
      v-model:visible="dialogVisible"
      :header="(form.id ? $t('workbench.character.edit') : $t('workbench.character.add')) + ' ' + $t('workbench.character.title')"
      width="560px"
      :confirm-btn="{ content: $t('common.save'), loading: saving }"
      :cancel-btn="$t('common.cancel')"
      :confirm-on-enter="false"
      :on-confirm="onSave">
      <div v-if="aiPreviewing" class="aiPreviewTip">{{ $t("workbench.character.previewEditDesc") }}</div>
      <t-form label-align="top" :label-width="80">
        <t-form-item :label="$t('workbench.character.name')" required-mark>
          <t-input v-model="form.name" :placeholder="$t('workbench.character.namePh')" />
        </t-form-item>
        <t-form-item :label="$t('workbench.character.gender')">
          <t-select v-model="form.gender" :options="genderOptions" />
        </t-form-item>
        <t-form-item :label="$t('workbench.character.personality')">
          <t-textarea v-model="form.personality" :autosize="{ minRows: 2, maxRows: 4 }" />
        </t-form-item>
        <t-form-item :label="$t('workbench.character.appearance')">
          <t-textarea v-model="form.appearance" :autosize="{ minRows: 2, maxRows: 4 }" />
        </t-form-item>
        <t-form-item :label="$t('workbench.character.background')">
          <t-textarea v-model="form.background" :autosize="{ minRows: 2, maxRows: 4 }" />
        </t-form-item>
        <t-form-item :label="$t('workbench.character.relations')">
          <t-textarea v-model="form.relations" :autosize="{ minRows: 2, maxRows: 3 }" />
        </t-form-item>
        <t-form-item :label="$t('workbench.character.voice')">
          <t-input v-model="form.voiceDesc" :placeholder="$t('workbench.character.voicePh')" />
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import axios from "@/utils/axios";
import modelSelect from "@/components/modelSelect.vue";
import AppEmpty from "@/components/feedback/AppEmpty.vue";

interface CharacterItem {
  id: number;
  name: string;
  gender: string;
  personality: string;
  appearance: string;
  background: string;
  relations: string;
  voiceDesc: string;
  createdAt: number;
  updatedAt: number;
}

const loading = ref(false);
const saving = ref(false);
const keyword = ref("");
const list = ref<CharacterItem[]>([]);
const dialogVisible = ref(false);
const form = ref<Partial<CharacterItem>>({});
const aiPreviewing = ref(false);

const genderOptions = [
  { label: $t("workbench.character.genderMale"), value: "男" },
  { label: $t("workbench.character.genderFemale"), value: "女" },
  { label: $t("workbench.character.genderOther"), value: "其他" },
];

const avatarPalette = ["#667eea", "#764ba2", "#2ba471", "#e37318", "#d54941", "#0c7fea"];
function avatarBg(id: number) {
  return avatarPalette[id % avatarPalette.length];
}

async function loadList() {
  loading.value = true;
  try {
    const { data } = await axios.get("/character/list", { params: { keyword: keyword.value.trim() } });
    list.value = data ?? [];
  } catch (e) {
    console.error(e);
    window.$message.error($t("workbench.character.fetchFailed"));
  } finally {
    loading.value = false;
  }
}

function openDialog(item?: CharacterItem) {
  aiPreviewing.value = false;
  form.value = item ? { ...item } : { name: "", gender: "女", personality: "", appearance: "", background: "", relations: "", voiceDesc: "" };
  dialogVisible.value = true;
}

async function onSave() {
  if (!form.value.name?.trim()) {
    window.$message.warning($t("workbench.character.nameRequired"));
    return;
  }
  saving.value = true;
  try {
    const payload = {
      name: form.value.name.trim(),
      gender: form.value.gender ?? "",
      personality: form.value.personality ?? "",
      appearance: form.value.appearance ?? "",
      background: form.value.background ?? "",
      relations: form.value.relations ?? "",
      voiceDesc: form.value.voiceDesc ?? "",
    };
    if (form.value.id) {
      await axios.post("/character/update", { id: form.value.id, ...payload });
    } else {
      await axios.post("/character/add", payload);
    }
    window.$message.success($t("workbench.character.saveSuccess"));
    dialogVisible.value = false;
    aiPreviewing.value = false;
    loadList();
  } catch (e) {
    console.error(e);
  } finally {
    saving.value = false;
  }
}

async function onDelete(item: CharacterItem) {
  try {
    await axios.post("/character/delete", { id: item.id });
    window.$message.success($t("workbench.character.deleteSuccess"));
    loadList();
  } catch (e) {
    console.error(e);
  }
}

// ────────────── AI 生成 ──────────────
const genDialogVisible = ref(false);
const genLoading = ref(false);
const genForm = ref({ name: "", description: "", model: "" });

function openGenerateDialog() {
  genForm.value = { name: "", description: "", model: "" };
  genDialogVisible.value = true;
}

async function onAiGenerate() {
  if (!genForm.value.name.trim() || !genForm.value.description.trim()) {
    window.$message.warning($t("workbench.character.nameRequired"));
    return;
  }
  if (!genForm.value.model) {
    window.$message.warning($t("workbench.character.aiModelRequired"));
    return;
  }
  genLoading.value = true;
  try {
    const { data } = await axios.post("/character/aiGenerate", genForm.value);
    genDialogVisible.value = false;
    aiPreviewing.value = true;
    form.value = {
      name: data?.name ?? genForm.value.name,
      gender: data?.gender ?? "女",
      personality: data?.personality ?? "",
      appearance: data?.appearance ?? "",
      background: data?.background ?? "",
      relations: data?.relations ?? "",
      voiceDesc: data?.voiceDesc ?? "",
    };
    dialogVisible.value = true;
    window.$message.success($t("workbench.character.generateSuccess"));
  } catch (e) {
    console.error(e);
    window.$message.error($t("workbench.character.generateFailed"));
  } finally {
    genLoading.value = false;
  }
}

// ────────────── AI 优化 ──────────────
const optDialogVisible = ref(false);
const optLoading = ref(false);
const optTarget = ref<CharacterItem | null>(null);
const optForm = ref({ model: "", focus: "" });

function openOptimizeDialog(item: CharacterItem) {
  optTarget.value = item;
  optForm.value = { model: "", focus: "" };
  optDialogVisible.value = true;
}

async function onAiOptimize() {
  if (!optForm.value.model) {
    window.$message.warning($t("workbench.character.aiModelRequired"));
    return;
  }
  optLoading.value = true;
  try {
    const { data } = await axios.post("/character/aiOptimize", {
      id: optTarget.value!.id,
      model: optForm.value.model,
      focus: optForm.value.focus?.trim() || undefined,
    });
    optDialogVisible.value = false;
    aiPreviewing.value = true;
    form.value = {
      id: optTarget.value!.id,
      name: data?.name ?? optTarget.value!.name,
      gender: data?.gender ?? optTarget.value!.gender ?? "女",
      personality: data?.personality ?? "",
      appearance: data?.appearance ?? "",
      background: data?.background ?? "",
      relations: data?.relations ?? "",
      voiceDesc: data?.voiceDesc ?? "",
    };
    dialogVisible.value = true;
    window.$message.success($t("workbench.character.generateSuccess"));
  } catch (e) {
    console.error(e);
    window.$message.error($t("workbench.character.generateFailed"));
  } finally {
    optLoading.value = false;
  }
}

// ────────────── 从小说/剧本提取 ──────────────
const extractDialogVisible = ref(false);
const extractLoading = ref(false);
const batchSaving = ref(false);
const projectList = ref<{ id: number; name: string }[]>([]);
const extractForm = ref({ projectId: undefined as number | undefined, source: "novel", model: "" });
const extractResult = ref<{ name: string; gender: string; personality: string; appearance: string; background: string; relations: string; voiceDesc: string }[]>([]);
const extractSelected = ref<string[]>([]);

async function openExtractDialog() {
  extractForm.value = { projectId: undefined, source: "novel", model: "" };
  extractResult.value = [];
  extractSelected.value = [];
  extractDialogVisible.value = true;
  try {
    const { data } = await axios.post("/task/getProject");
    projectList.value = data ?? [];
  } catch (e) {
    console.error(e);
  }
}

async function onAiExtract() {
  if (!extractForm.value.projectId) {
    window.$message.warning($t("workbench.character.aiExtractProjectPh"));
    return;
  }
  if (!extractForm.value.model) {
    window.$message.warning($t("workbench.character.aiModelRequired"));
    return;
  }
  extractLoading.value = true;
  extractResult.value = [];
  extractSelected.value = [];
  try {
    const { data } = await axios.post("/character/aiExtract", extractForm.value);
    extractResult.value = data ?? [];
    extractSelected.value = (data ?? []).map((i: any) => i.name);
    if (!extractResult.value.length) window.$message.info($t("workbench.character.aiExtractEmpty"));
  } catch (e) {
    console.error(e);
    window.$message.error($t("workbench.character.generateFailed"));
  } finally {
    extractLoading.value = false;
  }
}

async function onBatchSave() {
  if (!extractSelected.value.length) {
    window.$message.warning($t("workbench.character.batchSaveEmpty"));
    return;
  }
  batchSaving.value = true;
  try {
    for (const name of extractSelected.value) {
      const item = extractResult.value.find((i) => i.name === name);
      if (!item) continue;
      await axios.post("/character/add", {
        name: item.name,
        gender: item.gender ?? "",
        personality: item.personality ?? "",
        appearance: item.appearance ?? "",
        background: item.background ?? "",
        relations: item.relations ?? "",
        voiceDesc: item.voiceDesc ?? "",
      });
    }
    window.$message.success($t("workbench.character.saveSuccess"));
    extractDialogVisible.value = false;
    loadList();
  } catch (e) {
    console.error(e);
  } finally {
    batchSaving.value = false;
  }
}

onMounted(loadList);
</script>

<style lang="scss" scoped>
.characterSetting {
  .header {
    margin-bottom: 24px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    .headerActions {
      gap: var(--app-space-2);
    }
  }

  .cardGrid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--app-space-3);
  }

  .emptyActions {
    display: flex;
    gap: var(--app-space-2);
  }

  .charCard {
    .charHeader {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      .avatarWrap {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        color: #fff;
        font-size: 18px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .charName {
        .name {
          font-size: 16px;
          font-weight: 600;
        }
        .t-tag {
          margin-top: 2px;
        }
      }
    }
    .charBody {
      .charLine {
        display: flex;
        gap: 8px;
        margin-bottom: 6px;
        font-size: 14px;
        line-height: 1.5;
        .charLabel {
          color: var(--td-text-color-placeholder);
          flex-shrink: 0;
        }
        .charText {
          color: var(--td-text-color-secondary);
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
      }
    }
    .charFooter {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 12px;
      border-top: 1px solid var(--td-component-border);
      padding-top: 10px;
    }
  }

  .aiPreviewTip {
    margin-bottom: 16px;
    padding: 8px 12px;
    border-radius: 6px;
    background: var(--td-brand-color-light);
    color: var(--td-brand-color);
    font-size: 13px;
  }

  .extractRow {
    display: flex;
    gap: 16px;
    .extractItem {
      flex: 1;
    }
  }

  .extractActions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }

  .extractResult {
    .resultTitle {
      font-weight: 600;
      margin-bottom: 8px;
    }
    .resultList {
      max-height: 260px;
      overflow: auto;
      .resultChecks {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .resultItem {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 8px;
        border-radius: 6px;
        cursor: pointer;
        &:hover {
          background: var(--td-bg-color-container-hover);
        }
        .resultName {
          font-weight: 500;
        }
        .resultGender {
          font-size: 12px;
          color: var(--td-text-color-placeholder);
        }
      }
    }
  }
}
</style>
