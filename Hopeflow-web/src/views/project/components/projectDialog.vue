<template>
  <div class="addProject">
    <t-dialog
      placement="center"
      v-model:visible="addProjectShow"
      :header="isEdit ? $t('workbench.project.dialog.editTitle') : $t('workbench.project.dialog.addTitle')"
      width="60%"
      @close-btn-click="handleCancel"
      @cancel="handleCancel">
      <t-steps v-if="!isEdit" :current="currentStep" class="wizardSteps">
        <t-step-item :title="$t('workbench.project.wizard.step1')" />
        <t-step-item :title="$t('workbench.project.wizard.step2')" />
        <t-step-item :title="$t('workbench.project.wizard.step3')" />
      </t-steps>
      <!--
        AI 自由发挥的画风（如「暗黑科幻 / 赛博霓虹」）解析不到内置视觉手册时，
        以前只弹一句 info 就放行，整批提示词会报废（视觉手册未定义）。
        现在把它摆成必须处理的阻断项：直接从内置手册里选一个。
      -->
      <t-alert v-if="unmatchedArtStyle" theme="warning" class="configWarnPanel">
        <template #message>
          <div class="configWarnBody">
            <div class="configWarnTitle">
              {{ $t("workbench.project.msg.artStyleUnresolved", { artStyle: unmatchedArtStyle }) }}
            </div>
            <div class="configWarnTip">{{ $t("workbench.project.msg.artStylePickHint") }}</div>
            <div class="configWarnOptions">
              <t-button
                v-for="opt in artStyleCandidates"
                :key="opt.value"
                size="small"
                variant="outline"
                theme="warning"
                @click="applyArtStyleCandidate(opt.value)">
                {{ opt.label }}
              </t-button>
            </div>
          </div>
        </template>
      </t-alert>
      <div class="formColumns">
        <div class="formLeft">
          <t-form :data="formState" label-align="top">
            <t-form-item v-if="isEdit || currentStep === 0" :label="$t('workbench.project.dialog.projectType')">
              <t-select v-model="formState.projectType" :placeholder="$t('workbench.project.dialog.selectType')">
                <t-option key="基于小说原文" :label="$t('workbench.project.dialog.basedOnNovel')" value="novel" />
                <t-option key="基于剧本" :label="$t('workbench.project.dialog.basedOnScript')" value="script" />
              </t-select>
            </t-form-item>
            <t-form-item v-if="isEdit || currentStep === 0" :label="$t('workbench.project.dialog.projectName')">
              <t-input v-model="formState.name" :placeholder="$t('workbench.project.dialog.projectNamePh')" />
            </t-form-item>
            <t-form-item v-if="isEdit || currentStep === 0" :label="$t('workbench.project.dialog.novelType')">
              <t-input v-model="formState.type" :placeholder="$t('workbench.project.dialog.novelTypePh')" />
            </t-form-item>
            <t-form-item v-if="isEdit || currentStep === 0" :label="$t('workbench.project.dialog.needAdaptation')" required>
              <t-radio-group v-model="formState.needAdaptation">
                <t-radio value="1">{{ $t("workbench.project.dialog.needAdaptationYes") }}</t-radio>
                <t-radio value="0">{{ $t("workbench.project.dialog.needAdaptationNo") }}</t-radio>
              </t-radio-group>
            </t-form-item>
            <t-form-item v-if="isEdit || currentStep === 1" :label="$t('workbench.project.dialog.modelData')">
              <div class="ac" style="gap: 5px; width: 100%">
                <modelSelect v-model="formState.imageModel" type="image" />
                <t-select v-model="formState.imageQuality" class="paramSelect ml-5" :placeholder="$t('workbench.production.editImage.quality')">
                  <t-option value="1K" label="1K" />
                  <t-option value="2K" label="2K" />
                  <t-option value="4K" label="4K" />
                </t-select>
              </div>
            </t-form-item>
            <t-form-item v-if="isEdit || currentStep === 1" :label="$t('workbench.project.dialog.videoModelData')">
              <div class="ac" style="gap: 5px; width: 100%">
                <modelSelect v-model="formState.videoModel" type="video" @change="changeFn" :changeConfig="true" />
                <t-select v-model="formState.mode" class="paramSelect ml-5" :placeholder="$t('workbench.production.editImage.mode')">
                  <t-option v-for="value in mode" :key="value.value" :value="value.value" :label="value.label" />
                </t-select>
              </div>
            </t-form-item>
            <t-form-item v-if="isEdit || currentStep === 1" :label="$t('workbench.project.dialog.videoRatio')">
              <t-select v-model="formState.videoRatio" :options="RATIO_OPTIONS" />
            </t-form-item>
            <t-form-item v-if="isEdit || currentStep === 0" :label="$t('workbench.project.dialog.novelIntro')">
              <t-textarea
                v-model="formState.intro"
                :autosize="{ minRows: 3, maxRows: 6 }"
                :placeholder="$t('workbench.project.dialog.novelIntroPh')" />
            </t-form-item>
          </t-form>
        </div>
        <div class="formRight" v-if="isEdit || currentStep === 1">
          <t-form label-align="top">
            <t-form-item>
              <div class="artStylePicker">
                <div class="artStyleHeader">
                  <span>{{ $t("workbench.project.dialog.visualManual") }}</span>
                  <t-button size="small" variant="outline" @click="openVisualManualDialog()">
                    <template #icon><i-plus size="14" /></template>
                    {{ $t("workbench.project.dialog.newVisualManual") }}
                  </t-button>
                </div>
                <div class="artStyleContent">
                  <t-loading :loading="visualManualLoading" :text="$t('workbench.project.dialog.loading')">
                    <div class="gridContainer">
                      <div
                        v-for="(item, index) in visualManualOptions"
                        :key="index"
                        class="gridItem"
                        :class="{ active: formState.artStyle === item.stylePath }"
                        @click="formState.artStyle = item.stylePath">
                        <div class="imageWrapper">
                          <img :src="item.images && item.images[0]" :alt="item.name" class="artImage" loading="lazy" />
                          <div class="text">{{ item.name }}</div>
                        </div>
                        <t-button class="editBtn" shape="square" @click.stop="openVisualManualDialog(item)">
                          <i-edit theme="outline" size="14" />
                        </t-button>
                        <t-button class="delBtn" shape="square" @click.stop="deleteVisualManual(item)">
                          <i-delete theme="outline" size="14" />
                        </t-button>
                        <t-button class="preview" shape="square" @click.stop="handlePreview(item.images && item.images[0])">
                          <i-preview-open theme="outline" size="14" />
                        </t-button>
                      </div>
                    </div>
                  </t-loading>
                </div>
              </div>
            </t-form-item>
            <t-form-item>
              <div class="directorManual">
                <div class="directorManualHeader">
                  <span>{{ $t("workbench.project.dialog.directorManual") }}</span>
                  <t-button size="small" variant="outline" @click="openDirectorManualDialog()">
                    <template #icon><i-plus size="14" /></template>
                    {{ $t("workbench.project.dialog.addDirectorManual") }}
                  </t-button>
                </div>
                <div class="artStyleContent">
                  <t-loading :loading="directorManualLoading" :text="$t('workbench.project.dialog.loading')">
                    <div class="gridContainer">
                      <div
                        v-for="(item, index) in directorManualOptions"
                        :key="index"
                        class="gridItem"
                        :class="{ active: formState.directorManual === item.directorManual }"
                        @click="formState.directorManual = item.directorManual">
                        <div class="textCardWrapper">
                          <div class="textCardIcon">
                            <i-doc-text size="22" />
                          </div>
                          <div class="textCardTitle">{{ item.name }}</div>
                          <div class="textCardDesc">{{ directorManualDesc(item) }}</div>
                        </div>
                        <t-button class="editBtn" shape="square" @click.stop="openDirectorManualDialog(item)">
                          <i-edit theme="outline" size="14" />
                        </t-button>
                        <t-button class="delBtn" shape="square" @click.stop="deleteDirectorManual(item)">
                          <i-delete theme="outline" size="14" />
                        </t-button>
                      </div>
                    </div>
                  </t-loading>
                </div>
              </div>
            </t-form-item>
          </t-form>
        </div>
      </div>
      <!-- 创建模式第三步：确认预览 -->
      <div v-if="!isEdit && currentStep === 2" class="confirmStep">
        <div class="confirmRow" v-for="row in confirmRows" :key="row.label">
          <span class="confirmLabel">{{ row.label }}</span>
          <span class="confirmValue">{{ row.value || "-" }}</span>
        </div>
      </div>
      <template #footer>
        <div class="wizardFooter f ac jb">
          <t-button variant="outline" @click="handleCancel">{{ $t("workbench.project.dialog.cancel") }}</t-button>
          <t-space>
            <t-button v-if="!isEdit && currentStep > 0" variant="text" @click="handlePrev">{{ $t("workbench.project.wizard.prev") }}</t-button>
            <t-button v-if="!isEdit && currentStep < 2" theme="primary" @click="handleNext">{{ $t("workbench.project.wizard.next") }}</t-button>
            <t-button v-if="isEdit || currentStep === 2" theme="primary" @click="handleOk">
              {{ isEdit ? $t("workbench.project.dialog.save") : $t("workbench.project.wizard.submit") }}
            </t-button>
          </t-space>
        </div>
      </template>
    </t-dialog>
    <!-- 新建/编辑视觉手册弹窗 -->
    <t-dialog
      class="artStyleDialog"
      v-model:visible="visualManualDialogVisible"
      :header="editingVisualManual ? $t('workbench.project.dialog.editVisualManualTitle') : $t('workbench.project.dialog.newVisualManualTitle')"
      width="90vw"
      placement="center"
      @confirm="handleVisualManualSubmit"
      @close-btn-click="resetDirectorManualDialog"
      @cancel="resetDirectorManualDialog"
      :confirm-btn="$t('workbench.project.dialog.ok')"
      :cancel-btn="$t('workbench.project.dialog.cancel')">
      <t-loading :loading="loading">
        <t-form label-align="top">
          <t-form-item>
            <div class="nameAndCoverRow">
              <div class="nameField">
                <label class="fieldLabel">{{ $t("workbench.project.dialog.visualManualName") }}</label>
                <t-input v-model="visualManualForm.name" :placeholder="$t('workbench.project.dialog.visualManualNamePh')" />
              </div>
              <div class="mdFileLocation">
                <label class="fieldLabel">{{ $t("workbench.project.dialog.mdFile") }}</label>
                <t-input v-model="visualManualForm.stylePath" :disabled="!!editingVisualManual" />
              </div>
              <div class="coverField">
                <label class="fieldLabel">{{ $t("workbench.project.dialog.visualManualCover") }}</label>
                <div class="coverUploadArea multiCoverUploadArea">
                  <div v-for="(img, idx) in visualManualForm.images" :key="idx" class="coverPreview">
                    <img :src="img" class="coverImg" @click.stop="handlePreview(img && img)" style="cursor: pointer" />
                    <div class="coverImgRemove" @click="removeVisualManualCover(idx)">
                      <i-close size="10" />
                    </div>
                  </div>
                  <div class="coverUploadTrigger" @click="triggerVisualManualCoverUpload">
                    <input
                      ref="visualManualCoverInputRef"
                      type="file"
                      accept="image/*"
                      multiple
                      style="display: none"
                      @change="handleVisualManualCoverFileChange" />
                    <i-plus size="24" />
                    <span>{{ $t("workbench.project.dialog.uploadCover") }}</span>
                  </div>
                </div>
              </div>
            </div>
          </t-form-item>
          <t-form-item :label="$t('workbench.project.dialog.visualManualPrompt')">
            <div class="promptEditorWrapper">
              <div class="promptEditorHeader">
                <div class="aiExtractInline">
                  <t-tabs :value="visualManualTabValue" size="medium" @change="(v) => (visualManualTabValue = v)">
                    <t-tab-panel v-for="tab in visualManualTabData" :key="tab.value" :value="tab.value" :label="tab.label">
                      <MdEditor
                        v-model="tab.data"
                        :theme="themeSetting.mode === 'auto' ? 'light' : themeSetting.mode"
                        :toolbars="promptToolbars"
                        :footers="[]"
                        :placeholder="$t('workbench.project.dialog.promptPlaceholder')"
                        style="height: 30vh; margin-top: 5px"
                        @onUploadImg="() => {}" />
                    </t-tab-panel>
                  </t-tabs>
                </div>
              </div>
            </div>
          </t-form-item>
        </t-form>
      </t-loading>
    </t-dialog>
    <!-- 新建/编辑导演手册弹窗 -->
    <t-dialog
      class="artStyleDialog"
      v-model:visible="directorDialogVisible"
      :header="editingDirectorManual ? $t('workbench.project.dialog.editingDirectorManual') : $t('workbench.project.dialog.newDirecorManualTitle')"
      width="90vw"
      placement="center"
      @confirm="handleDirectorManualSubmit"
      @close-btn-click="resetVisualManualDialog"
      @cancel="resetVisualManualDialog"
      :confirm-btn="$t('workbench.project.dialog.ok')"
      :cancel-btn="$t('workbench.project.dialog.cancel')">
      <t-loading :loading="loading">
        <t-form label-align="top">
          <t-form-item>
            <div class="nameAndCoverRow">
              <div class="nameField">
                <label class="fieldLabel">{{ $t("workbench.project.dialog.directorManualName") }}</label>
                <t-input v-model="directorManualForm.name" :placeholder="$t('workbench.project.dialog.directorManualNamePh')" />
              </div>
              <div class="mdFileLocation">
                <label class="fieldLabel">{{ $t("workbench.project.dialog.directorFile") }}</label>
                <t-input v-model="directorManualForm.directorManual" :disabled="!!editingDirectorManual" />
              </div>
            </div>
          </t-form-item>
          <t-form-item :label="$t('workbench.project.dialog.directorManualPrompt')">
            <div class="promptEditorWrapper">
              <div class="promptEditorHeader">
                <div class="aiExtractInline">
                  <t-tabs :value="directorManualTabValue" size="medium" @change="(v) => (directorManualTabValue = v)">
                    <t-tab-panel v-for="tab in directorManualTabData" :key="tab.value" :value="tab.value" :label="tab.label">
                      <MdEditor
                        v-model="tab.data"
                        :theme="themeSetting.mode === 'auto' ? 'light' : themeSetting.mode"
                        :toolbars="promptToolbars"
                        :footers="[]"
                        :placeholder="$t('workbench.project.dialog.promptPlaceholder')"
                        style="height: 30vh; margin-top: 5px"
                        @onUploadImg="() => {}" />
                    </t-tab-panel>
                  </t-tabs>
                </div>
              </div>
            </div>
          </t-form-item>
        </t-form>
      </t-loading>
    </t-dialog>
    <t-image-viewer v-model="visible" :images="[trigger]" :closeOnOverlay="true" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import axios from "@/utils/axios";
import { MdEditor } from "md-editor-v3";
import settingStore from "@/stores/setting";
const { themeSetting } = storeToRefs(settingStore());
import type { ToolbarNames } from "md-editor-v3";
import modelSelect from "@/components/modelSelect.vue";
import type { TabValue } from "tdesign-vue-next";
import { DialogPlugin } from "tdesign-vue-next";

const addProjectShow = defineModel<boolean>();
const props = defineProps<{
  projectData?: ProjectData | null;
  prefillData?: Partial<ProjectFormData> | null;
}>();
const emit = defineEmits<{
  (e: "add", data: ProjectFormData): void;
  (
    e: "edit",
    data: {
      id: string;
      name: string;
      intro: string;
      type: string;
      artStyle: string;
      directorManual: string;
      videoRatio: string;
      imageModel: string;
      videoModel: string;
      projectType: string;
      imageQuality: "1K" | "2K" | "4K" | "";
      mode: string;
      needAdaptation: string;
    },
  ): void;
}>();

// ===== 类型定义 =====
interface ProjectData {
  id: string;
  name: string;
  intro: string;
  type: string;
  artStyle: string | null;
  directorManual: string | null;
  videoRatio: string | null;
  imageModel: string;
  videoModel: string;
  projectType: string;
  imageQuality: "1K" | "2K" | "4K" | "";
  visualManual?: string;
  mode: string;
  needAdaptation: string;
}

interface ProjectFormData {
  projectType: string;
  name: string;
  intro: string;
  type: string;
  artStyle: string;
  directorManual: string;
  videoRatio: string;
  imageModel: string;
  videoModel: string;
  imageQuality: "1K" | "2K" | "4K" | "";
  mode: string;
  needAdaptation: string;
  /** 画风解析不到时后端回传的内置手册候选 */
  artStyleCandidates?: { value: string; label: string }[];
}
interface VisualManualItem {
  name: string;
  images?: string[];
  data?: Data[];
  stylePath: string;
}
interface Data {
  label: string;
  value: string;
  data: string;
}
//预览
const trigger = ref();
const visible = ref(false);
function handlePreview(src: string | undefined) {
  visible.value = true;
  trigger.value = src;
}

const DEFAULT_TAB_DATA: () => Data[] = () => [
  { label: "README", value: "README", data: "" },
  { label: "前缀", value: "prefix", data: "" },
  { label: "角色", value: "art_character", data: "" },
  { label: "角色衍生", value: "art_character_derivative", data: "" },
  { label: "道具", value: "art_prop", data: "" },
  { label: "道具衍生", value: "art_prop_derivative", data: "" },
  { label: "场景", value: "art_scene", data: "" },
  { label: "场景衍生", value: "art_scene_derivative", data: "" },
  { label: "分镜", value: "director_storyboard", data: "" },
  { label: "分镜视频", value: "art_storyboard_video", data: "" },
  { label: "光影与氛围", value: "art_lighting_atmosphere", data: "" },
  { label: "构图与镜头", value: "art_composition_camera", data: "" },
  { label: "材质与质感", value: "art_texture_material", data: "" },
  { label: "技法-导演规划", value: "director_planning_style", data: "" },
  { label: "技法-分镜表设计", value: "director_storyboard_table_style", data: "" },
];

const isEdit = computed(() => !!props.projectData);

// ===== 常量 =====
const RATIO_OPTIONS = [
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
];

const DEFAULT_FORM: () => ProjectFormData & { id: number; era: string; createTime: number; userId: number } = () => ({
  id: 0,
  projectType: "novel",
  name: "",
  intro: "",
  type: "",
  artStyle: "",
  era: "",
  videoRatio: "16:9",
  createTime: 0,
  userId: 0,
  imageModel: "",
  videoModel: "",
  imageQuality: "",
  mode: "",
  directorManual: "",
  needAdaptation: "1",
});

// ===== 表单 =====
const formState = ref(DEFAULT_FORM());

/** AI 给出但解析不到内置视觉手册的画风（非空时界面顶部会强制要求重选） */
const unmatchedArtStyle = ref("");
/** 内置手册候选，供上一行直接点选 */
const artStyleCandidates = ref<{ value: string; label: string }[]>([]);

function applyArtStyleCandidate(stylePath: string) {
  formState.value.artStyle = stylePath;
  unmatchedArtStyle.value = "";
  artStyleCandidates.value = [];
  window.$message.success($t("workbench.project.msg.artStyleApplied"));
}

/** 把后端给出的建议值落到表单上（画风/手册/模式/画质） */
function applyConfigSuggestions(issues: { field: string; suggestion?: string }[]) {
  for (const issue of issues) {
    if (!issue.suggestion) continue;
    if (issue.field === "artStyle") formState.value.artStyle = issue.suggestion;
    else if (issue.field === "directorManual") formState.value.directorManual = issue.suggestion;
    else if (issue.field === "mode") formState.value.mode = issue.suggestion;
    else if (issue.field === "imageQuality") formState.value.imageQuality = issue.suggestion as "1K" | "2K" | "4K";
  }
}

/**
 * 保存前的落地校验。
 *
 * 现场最贵的坑：AI 自由发挥的 artStyle 直接落库，系统只认能解析到 art_skills 目录的值，
 * 整批提示词报废。这里在提交前用同一套后端规则复核，能自动修的（有建议值）问一次就应用，
 * 不能自动修的直接挡下来。后端 addProject/editProject 也会再校验一次兜底。
 */
async function validateBeforeSubmit(): Promise<boolean> {
  try {
    const { data } = await axios.post("/project/configOptions", {
      artStyle: formState.value.artStyle,
      directorManual: formState.value.directorManual,
      imageModel: formState.value.imageModel,
      videoModel: formState.value.videoModel,
      imageQuality: formState.value.imageQuality,
      videoRatio: formState.value.videoRatio,
      mode: formState.value.mode,
    });
    const issues: { field: string; code: string; message: string; suggestion?: string }[] = data?.validation?.issues ?? [];
    if (!issues.length) return true;

    const blocked = issues.filter((i) => !i.suggestion);
    if (blocked.length) {
      window.$message.error(blocked[0].message);
      return false;
    }

    return await new Promise<boolean>((resolve) => {
      const dialog = DialogPlugin.confirm({
        header: $t("workbench.project.msg.configFixHeader"),
        body: issues.map((i) => `· ${i.message}`).join("\n"),
        confirmBtn: $t("workbench.project.msg.configFixApply"),
        cancelBtn: $t("common.cancel"),
        onConfirm: () => {
          applyConfigSuggestions(issues);
          dialog.destroy();
          resolve(true);
        },
        onCancel: () => {
          dialog.destroy();
          resolve(false);
        },
        onClose: () => {
          dialog.destroy();
          resolve(false);
        },
      });
    });
  } catch {
    // 校验接口本身异常时不阻塞保存，后端仍有同一套规则兜底
    return true;
  }
}

function resetForm() {
  formState.value = DEFAULT_FORM();
}

// ===== 创建向导：三步步骤 + 草稿 =====
const currentStep = ref(0);
const DRAFT_KEY = "projectWizardDraft";

function handleNext() {
  if (currentStep.value === 0) {
    if (!formState.value.name) return window.$message.warning($t("workbench.project.msg.enterProjectName"));
    if (!formState.value.type) return window.$message.warning($t("workbench.project.msg.enterProjectType"));
    if (!formState.value.needAdaptation) return window.$message.warning($t("workbench.project.msg.enterAdaptation"));
    if (!formState.value.intro) return window.$message.warning($t("workbench.project.msg.enterProjectIntro"));
  } else if (currentStep.value === 1) {
    if (!formState.value.imageModel) return window.$message.warning($t("workbench.project.msg.enterImageModel"));
    if (!formState.value.videoModel) return window.$message.warning($t("workbench.project.msg.enterVideoModel"));
    if (!formState.value.artStyle) return window.$message.warning($t("workbench.project.msg.enterArtStyle"));
    if (!formState.value.directorManual) return window.$message.warning($t("workbench.project.msg.directorManual"));
    if (!formState.value.videoRatio) return window.$message.warning($t("workbench.project.msg.enterVideoRatio"));
    if (!formState.value.imageQuality) return window.$message.warning($t("workbench.project.msg.enterProjectQuality"));
    if (!formState.value.mode) return window.$message.warning($t("workbench.project.msg.selectMode"));
  }
  currentStep.value += 1;
}

function handlePrev() {
  if (currentStep.value > 0) currentStep.value -= 1;
}

// 创建模式草稿：中途关闭保存，下次打开恢复，提交成功后清除
function saveDraft() {
  if (isEdit.value) return;
  const { id, era, createTime, userId, ...rest } = formState.value;
  localStorage.setItem(DRAFT_KEY, JSON.stringify(rest));
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

function restoreDraft() {
  if (isEdit.value) return false;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return false;
    formState.value = { ...DEFAULT_FORM(), ...JSON.parse(raw) };
    window.$message.info($t("workbench.project.wizard.draftRestored"));
    return true;
  } catch (e) {
    return false;
  }
}

// 第三步确认预览数据
const confirmRows = computed(() => {
  const artStyleName = visualManualOptions.value.find((i) => i.stylePath === formState.value.artStyle)?.name || formState.value.artStyle;
  const directorName = directorManualOptions.value.find((i) => i.directorManual === formState.value.directorManual)?.name || formState.value.directorManual;
  const modeName = mode.value.find((i) => i.value === formState.value.mode)?.label || formState.value.mode;
  return [
    { label: $t("workbench.project.dialog.projectType"), value: formState.value.projectType === "novel" ? $t("workbench.project.dialog.basedOnNovel") : $t("workbench.project.dialog.basedOnScript") },
    { label: $t("workbench.project.dialog.projectName"), value: formState.value.name },
    { label: $t("workbench.project.dialog.novelType"), value: formState.value.type },
    { label: $t("workbench.project.dialog.needAdaptation"), value: formState.value.needAdaptation === "1" ? $t("workbench.project.dialog.needAdaptationYes") : $t("workbench.project.dialog.needAdaptationNo") },
    { label: $t("workbench.project.dialog.artStyle"), value: artStyleName },
    { label: $t("workbench.project.dialog.directorManual"), value: directorName },
    { label: $t("workbench.project.dialog.videoRatio"), value: formState.value.videoRatio },
    { label: $t("workbench.project.dialog.modelData"), value: formState.value.imageModel },
    { label: $t("workbench.project.dialog.videoModelData"), value: formState.value.videoModel },
    { label: $t("workbench.production.editImage.quality"), value: formState.value.imageQuality },
    { label: $t("workbench.production.editImage.mode"), value: modeName },
    { label: $t("workbench.project.dialog.novelIntro"), value: formState.value.intro },
  ];
});

function handleCancel() {
  if (!isEdit.value) saveDraft();
  addProjectShow.value = false;
  resetForm();
}

async function handleOk() {
  if (!formState.value.name) return window.$message.warning($t("workbench.project.msg.enterProjectName"));
  if (!formState.value.type) return window.$message.warning($t("workbench.project.msg.enterProjectType"));
  if (!formState.value.needAdaptation) return window.$message.warning($t("workbench.project.msg.enterAdaptation"));
  if (!formState.value.imageModel) return window.$message.warning($t("workbench.project.msg.enterImageModel"));
  if (!formState.value.videoModel) return window.$message.warning($t("workbench.project.msg.enterVideoModel"));
  if (!formState.value.artStyle) return window.$message.warning($t("workbench.project.msg.enterArtStyle"));
  if (!formState.value.directorManual) return window.$message.warning($t("workbench.project.msg.directorManual"));
  if (!formState.value.videoRatio) return window.$message.warning($t("workbench.project.msg.enterVideoRatio"));
  if (!formState.value.intro) return window.$message.warning($t("workbench.project.msg.enterProjectIntro"));
  if (!formState.value.imageQuality) return window.$message.warning($t("workbench.project.msg.enterProjectQuality"));
  if (!formState.value.mode) return window.$message.warning($t("workbench.project.msg.selectMode"));
  // 保存前的落地校验：画风/导演手册必须能解析到内置手册，mode 必须与视频模型匹配，
  // 画质必须在模型支持范围内（后端 addProject/editProject 也会再校验一次）
  if (!(await validateBeforeSubmit())) return;
  if (isEdit.value) {
    emit("edit", {
      id: formState.value.id as unknown as string,
      name: formState.value.name,
      intro: formState.value.intro,
      type: formState.value.type,
      artStyle: formState.value.artStyle,
      videoRatio: formState.value.videoRatio,
      imageModel: formState.value.imageModel,
      videoModel: formState.value.videoModel,
      projectType: formState.value.projectType || "novel",
      directorManual: formState.value.directorManual,
      imageQuality: formState.value.imageQuality,
      mode: formState.value.mode,
      needAdaptation: formState.value.needAdaptation,
    });
  } else {
    emit("add", {
      projectType: formState.value.projectType || "novel",
      name: formState.value.name,
      intro: formState.value.intro,
      type: formState.value.type,
      artStyle: formState.value.artStyle,
      videoRatio: formState.value.videoRatio || "16:9",
      imageModel: formState.value.imageModel,
      videoModel: formState.value.videoModel,
      imageQuality: formState.value.imageQuality,
      directorManual: formState.value.directorManual,
      mode: formState.value.mode,
      needAdaptation: formState.value.needAdaptation,
    });
    clearDraft();
  }
  resetForm();
  addProjectShow.value = false;
}

// ===== 视觉手册 Prompt 工具栏 =====

const promptToolbars: ToolbarNames[] = [
  "bold",
  "italic",
  "strikeThrough",
  "-",
  "unorderedList",
  "orderedList",
  "-",
  "revoke",
  "next",
  "=",
  "preview",
];

watch(addProjectShow, async (visible) => {
  if (visible) {
    if (props.projectData) {
      formState.value = {
        ...DEFAULT_FORM(),
        id: props.projectData.id as unknown as number,
        name: props.projectData.name || "",
        intro: props.projectData.intro || "",
        type: props.projectData.type || "",
        artStyle: props.projectData.artStyle || "",
        videoRatio: props.projectData.videoRatio || "16:9",
        imageModel: props.projectData.imageModel || "",
        videoModel: props.projectData.videoModel || "",
        imageQuality: props.projectData.imageQuality || "",
        projectType: props.projectData.projectType || "novel",
        mode: props.projectData.mode || "text",
        directorManual: props.projectData.directorManual || "",
        needAdaptation: props.projectData.needAdaptation || "1",
      };
      // 编辑模式下主动获取视频模型详情，填充 mode 列表以回显 label
      if (props.projectData.videoModel) {
        try {
          const { data } = await axios.post("/modelSelect/getModelDetail", {
            modelId: props.projectData.videoModel,
          });
          if (data?.mode) {
            mode.value = data.mode.map((item: any) => ({
              label: getModeLabel(item),
              value: modeToKey(item),
            }));
          }
        } catch (e) {
          // 获取失败不影响其他功能
        }
      }
    } else if (props.prefillData) {
      formState.value = { ...DEFAULT_FORM(), ...props.prefillData };
      const aiArtStyle = props.prefillData.artStyle;
      const isAiQuickCreate = !!(props.prefillData.imageModel && props.prefillData.videoModel && props.prefillData.directorManual);
      // 先等手册列表就位，才能判断画风到底能不能解析，再决定是否直接进确认页
      await fetchVisualManuals();
      let artStyleResolved = false;
      if (aiArtStyle) {
        const matched = visualManualOptions.value.find(
          (i) => i.name.includes(aiArtStyle) || i.stylePath.includes(aiArtStyle) || aiArtStyle.includes(i.name),
        );
        if (matched) {
          formState.value.artStyle = matched.stylePath;
          artStyleResolved = true;
        } else {
          // 解析不到就不再放行：清空画风并给出候选，用户必须从内置手册里选一个
          formState.value.artStyle = "";
          unmatchedArtStyle.value = aiArtStyle;
          const fromBackend = (props.prefillData as { artStyleCandidates?: { value: string; label: string }[] }).artStyleCandidates;
          artStyleCandidates.value =
            fromBackend?.length ? fromBackend : visualManualOptions.value.slice(0, 8).map((i) => ({ value: i.stylePath, label: i.name }));
          window.$message.warning($t("workbench.project.msg.artStyleUnresolved", { artStyle: aiArtStyle }));
        }
      }
      // 全自动创建且画风可解析：配置已由后端补齐，直接跳转确认页；并回显视频模型 mode 选项
      if (isAiQuickCreate && (artStyleResolved || !aiArtStyle)) {
        currentStep.value = 2;
        if (props.prefillData.videoModel) {
          try {
            const { data } = await axios.post("/modelSelect/getModelDetail", {
              modelId: props.prefillData.videoModel,
            });
            if (data?.mode) {
              mode.value = data.mode.map((item: any) => ({
                label: getModeLabel(item),
                value: modeToKey(item),
              }));
            }
          } catch (e) {
            // 获取失败不影响其他功能
          }
        }
      } else {
        // 画风解析不到，或者不走全自动快速创建：回到带视觉手册选择器的第二步，
        // 让用户从内置手册里直接点一个（顶部同时给出候选项）
        if (aiArtStyle && !artStyleResolved) currentStep.value = 1;
      }
    } else {
      resetForm();
      fetchVisualManuals();
      restoreDraft();
    }
    queryDirectorManual();
  }
});

// ===== 视觉手册 =====
const visualManualOptions = ref<VisualManualItem[]>([]);
const visualManualLoading = ref(false);
const visualManualDialogVisible = ref(false);
const editingVisualManual = ref<VisualManualItem | null>(null);
const visualManualForm = ref({ name: "", images: [] as string[], stylePath: "" });
const visualManualCoverInputRef = ref<HTMLInputElement>();
const visualManualTabValue = ref<TabValue>("README");
const visualManualTabData = ref<Data[]>(DEFAULT_TAB_DATA());

function fetchVisualManuals() {
  visualManualLoading.value = true;
  return axios
    .post("/project/getVisualManual")
    .then(({ data }) => {
      visualManualOptions.value = data.map(
        (item: { id?: string | number; name: string; image?: string | string[]; images?: string[]; data?: Data[]; stylePath: string }) => ({
          id: item.id,
          name: item.name,
          stylePath: item.stylePath,
          images: item.images ?? (Array.isArray(item.image) ? item.image : item.image ? [item.image] : []),
          data: item.data,
        }),
      );
    })
    .finally(() => {
      visualManualLoading.value = false;
    });
}

function openVisualManualDialog(item?: VisualManualItem) {
  editingVisualManual.value = item ?? null;
  if (item) {
    visualManualForm.value.name = item.name;
    visualManualForm.value.stylePath = item.stylePath;
    visualManualForm.value.images = item.images ? [...item.images] : [];
    const existingData: Data[] = Array.isArray(item.data) ? item.data : [];
    visualManualTabData.value = DEFAULT_TAB_DATA().map((tab) => {
      const found = existingData.find((d) => d.value === tab.value);
      return found ? { ...tab, data: found.data } : { ...tab };
    });
  } else {
    visualManualForm.value = { name: "", images: [], stylePath: "" };
    visualManualTabData.value = DEFAULT_TAB_DATA();
  }
  visualManualTabValue.value = "README";
  visualManualDialogVisible.value = true;
}

function resetVisualManualDialog() {
  visualManualDialogVisible.value = false;
  editingVisualManual.value = null;
  visualManualForm.value = { name: "", images: [], stylePath: "" };
  visualManualTabData.value = DEFAULT_TAB_DATA();
  visualManualTabValue.value = "README";
}

function triggerVisualManualCoverUpload() {
  visualManualCoverInputRef.value?.click();
}

function handleVisualManualCoverFileChange(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (!files || files.length === 0) return;
  Array.from(files).forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      visualManualForm.value.images.push(reader.result as string);
    };
    reader.readAsDataURL(file);
  });
  (e.target as HTMLInputElement).value = "";
}

function removeVisualManualCover(idx: number) {
  visualManualForm.value.images.splice(idx, 1);
}
const loading = ref(false);
async function handleVisualManualSubmit() {
  if (!visualManualForm.value.name.trim()) {
    window.$message.warning($t("workbench.project.msg.enterVisualManualName"));
    return;
  }
  if (!visualManualForm.value.images.length) {
    window.$message.warning($t("workbench.project.msg.enterVisualManualImage"));
    return;
  }
  const emptyTab = visualManualTabData.value.find((tab) => !tab.data.trim());
  if (emptyTab) return window.$message.warning(`「${emptyTab.label}」${$t("workbench.project.msg.enterVisualManualTabData")}`);
  try {
    loading.value = true;
    if (editingVisualManual.value) {
      await axios.post("/project/editVisualManual", {
        name: visualManualForm.value.name,
        images: visualManualForm.value.images,
        data: visualManualTabData.value,
        stylePath: visualManualForm.value.stylePath,
      });
    } else {
      await axios.post("/project/addVisualManual", {
        name: visualManualForm.value.name,
        images: visualManualForm.value.images,
        data: visualManualTabData.value,
        stylePath: visualManualForm.value.stylePath,
      });
    }

    loading.value = false;
    if (editingVisualManual.value) {
      window.$message.success($t("workbench.project.msg.visualManualUpdated"));
    } else {
      window.$message.success($t("workbench.project.msg.visualManualAdded"));
    }
    resetVisualManualDialog();
    fetchVisualManuals();
  } catch (e: any) {
    loading.value = false;
    window.$message.error(e.message ?? $t("workbench.project.msg.operationFailed"));
  }
}
function deleteVisualManual(item: VisualManualItem) {
  const dialog = DialogPlugin.confirm({
    header: $t("workbench.project.msg.deleteVisualManualHeader"),
    body: $t("workbench.project.msg.deleteVisualManualBody", { name: item.stylePath }),
    confirmBtn: $t("workbench.project.msg.deleteVisualManualConfirm"),
    cancelBtn: $t("workbench.project.msg.deleteVisualManualCancel"),
    onConfirm: () => {
      axios
        .post("/project/deleteVisualManual", { name: item.stylePath }, { silent: true })
        .then(() => {
          fetchVisualManuals();
          resetVisualManualDialog();
          window.$message.success($t("workbench.project.msg.visualManualDeleted"));
        })
        .catch((e) => {
          window.$message.error(e.message ?? $t("workbench.project.msg.operationFailed"));
        })
        .finally(() => {
          fetchVisualManuals();
          dialog.destroy();
        });
    },
  });
}
type VideoMode =
  | "singleImage" //单图参考
  | "startEndRequired" //首尾帧（两张都得有）
  | "endFrameOptional" //首尾帧（尾帧可选）
  | "startFrameOptional" //首尾帧（首帧可选）
  | "text" //文本
  | (`videoReference:${number}` | `imageReference:${number}` | `audioReference:${number}`)[]; //多参考（数字代表限制数量）
const mode = ref<{ label: string; value: string }[]>([]);
const MODE_LABEL: Record<string, string> = {
  singleImage: $t("workbench.production.generate.modeSingleImage"),
  startEndRequired: $t("workbench.production.generate.modeStartEnd"),
  endFrameOptional: $t("workbench.production.generate.modeStartEnd"),
  startFrameOptional: $t("workbench.production.generate.modeStartEnd"),
  text: $t("workbench.production.generate.modeText"),
  videoReference: $t("workbench.production.generate.modeVideoRef"),
  imageReference: $t("workbench.production.generate.modeImageRef"),
  audioReference: $t("workbench.production.generate.modeAudioRef"),
};
// 模式转换为统一的 key 形式，方便后续处理
function getModeLabel(mode?: VideoMode): string {
  if (!mode) return "";
  if (Array.isArray(mode)) return mode.map((r) => MODE_LABEL[r.replace(/:.*$/, "")] ?? r).join("、");
  return MODE_LABEL[mode] ?? mode;
}
//模式数组转换为字符串 key，方便在前端使用和比较
function modeToKey(m: VideoMode): string {
  return Array.isArray(m) ? JSON.stringify(m) : m;
}
//获取模式
function changeFn(_val: string, data: any) {
  mode.value = data.mode.map((item: any) => ({
    label: getModeLabel(item),
    value: modeToKey(item),
  }));
}
//导演手册
interface DirectorManualItem {
  name: string;
  images?: string[];
  data?: Data[];
  directorManual: string;
}
const DIRECTOR_DEFAULT_TAB_DATA: () => Data[] = () => [
  { label: "README", value: "README", data: "" },
  { label: "导演规划", value: "director_planning_narrative", data: "" },
  { label: "分镜表", value: "director_storyboard_table_narrative", data: "" },
];
const directorManualForm = ref({ name: "", images: [] as string[], directorManual: "" });
const directorManualLoading = ref(false);
const editingDirectorManual = ref<DirectorManualItem | null>(null);
const directorDialogVisible = ref(false);
const directorManualOptions = ref<DirectorManualItem[]>([]);
const directorManualTabValue = ref<TabValue>("README");
const directorManualTabData = ref<Data[]>(DIRECTOR_DEFAULT_TAB_DATA());
//查询导演手册
function queryDirectorManual() {
  directorManualLoading.value = true;
  axios
    .post("/project/queryDirectorManual")
    .then(({ data }) => {
      directorManualOptions.value = data.map(
        (item: { id?: string | number; name: string; image?: string | string[]; images?: string[]; data?: Data[]; directorManual: string }) => ({
          id: item.id,
          name: item.name,
          directorManual: item.directorManual,
          images: item.images ?? (Array.isArray(item.image) ? item.image : item.image ? [item.image] : []),
          data: item.data,
        }),
      );
    })
    .finally(() => {
      directorManualLoading.value = false;
    });
}
//导演手册文字卡摘要：取 README 内容、去掉首行标题，截取约 60 字作描述预览
function directorManualDesc(item: DirectorManualItem): string {
  const readme = Array.isArray(item.data) ? item.data.find((d) => d.value === "README") : undefined;
  const content = (readme?.data ?? "").trim();
  const withoutTitle = content.replace(/^#.*\n?/, "").trim();
  const desc = withoutTitle.replace(/\s+/g, " ").slice(0, 60);
  return desc || $t("workbench.project.dialog.directorManual");
}
//新建导演手册
function openDirectorManualDialog(item?: DirectorManualItem) {
  editingDirectorManual.value = item ?? null;
  if (item) {
    directorManualForm.value.name = item.name;
    directorManualForm.value.directorManual = item.directorManual;
    directorManualForm.value.images = item.images ? [...item.images] : [];
    const existingData: Data[] = Array.isArray(item.data) ? item.data : [];
    directorManualTabData.value = DIRECTOR_DEFAULT_TAB_DATA().map((tab) => {
      const found = existingData.find((d) => d.value === tab.value);
      return found ? { ...tab, data: found.data } : { ...tab };
    });
  } else {
    directorManualForm.value = { name: "", images: [], directorManual: "" };
    directorManualTabData.value = DIRECTOR_DEFAULT_TAB_DATA();
  }
  directorManualTabValue.value = "README";
  directorDialogVisible.value = true;
}
function resetDirectorManualDialog() {
  directorDialogVisible.value = false;
  editingDirectorManual.value = null;
  directorManualForm.value = { name: "", images: [], directorManual: "" };
  directorManualTabData.value = DIRECTOR_DEFAULT_TAB_DATA();
  directorManualTabValue.value = "README";
}
function deleteDirectorManual(item: DirectorManualItem) {
  const dialog = DialogPlugin.confirm({
    header: $t("workbench.project.msg.deleteDirectorManualHeader"),
    body: $t("workbench.project.msg.deleteDirectorManualBody", { name: item.directorManual }),
    confirmBtn: $t("workbench.project.msg.deleteVisualManualConfirm"),
    cancelBtn: $t("workbench.project.msg.deleteVisualManualCancel"),
    onConfirm: () => {
      axios
        .post("/project/deleteDirectorManual", { name: item.directorManual })
        .then(() => {
          queryDirectorManual();
          resetDirectorManualDialog();
          window.$message.success($t("workbench.project.msg.visualManualDeleted"));
        })
        .catch((e) => {
          window.$message.error(e.message ?? $t("workbench.project.msg.operationFailed"));
        })
        .finally(() => {
          queryDirectorManual();
          dialog.destroy();
        });
    },
  });
}
//导演手册编辑和新增保存
async function handleDirectorManualSubmit() {
  if (!directorManualForm.value.name.trim()) {
    window.$message.warning($t("workbench.project.msg.enterVisualManualName"));
    return;
  }
  const emptyTab = directorManualTabData.value.find((tab) => !tab.data.trim());
  if (emptyTab) return window.$message.warning(`「${emptyTab.label}」${$t("workbench.project.msg.enterVisualManualTabData")}`);
  try {
    loading.value = true;
    if (editingDirectorManual.value) {
      await axios.post("/project/editDirectorlManual", {
        name: directorManualForm.value.name,
        images: directorManualForm.value.images,
        data: directorManualTabData.value,
        directorManual: directorManualForm.value.directorManual,
      }, { silent: true });
    } else {
      await axios.post("/project/addDirectorManual", {
        name: directorManualForm.value.name,
        images: directorManualForm.value.images,
        data: directorManualTabData.value,
        directorManual: directorManualForm.value.directorManual,
      }, { silent: true });
    }

    loading.value = false;
    if (editingDirectorManual.value) {
      window.$message.success($t("workbench.project.msg.directorManualUpdated"));
    } else {
      window.$message.success($t("workbench.project.msg.directorManualAdded"));
    }
    resetDirectorManualDialog();
    queryDirectorManual();
  } catch (e: any) {
    loading.value = false;
    window.$message.error(e.message ?? $t("workbench.project.msg.operationFailed"));
  }
}
</script>

<style lang="scss" scoped>
.wizardSteps {
  margin-bottom: 24px;
}
.formColumns {
  display: flex;
  gap: 24px;

  .formLeft {
    flex: 1;
    min-width: 0;
  }

  .formRight {
    flex: 1;
    min-width: 0;
  }
}
.wizardFooter {
  width: 100%;
}
.confirmStep {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px 4px;

  .confirmRow {
    display: flex;
    align-items: flex-start;
    gap: 16px;

    .confirmLabel {
      flex-shrink: 0;
      width: 120px;
      color: var(--td-text-color-secondary);
    }

    .confirmValue {
      flex: 1;
      word-break: break-all;
    }
  }
}
.directorManual {
  width: 100%;
  height: 50%;
  .directorManualHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .artStyleContent {
    height: 300px;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 4px;
  }
}
.artStylePicker {
  width: 100%;
  height: 50%;
  .artStyleHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .artStyleContent {
    height: 300px;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 4px;
  }
}

.gridContainer {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 8px;

  // 导演手册纯文字卡片
  .textCardWrapper {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    width: 100%;
    min-height: 96px;
    padding: 10px 6px;
    border-radius: 4px;
    background: linear-gradient(160deg, var(--td-brand-color-1) 0%, var(--td-bg-color-container-hover) 100%);
    color: var(--td-text-color-primary);
    overflow: hidden;

    .textCardIcon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.6);
      color: var(--td-brand-color);
    }

    .textCardTitle {
      font-size: 13px;
      font-weight: 600;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }

    .textCardDesc {
      font-size: 11px;
      line-height: 1.4;
      color: var(--td-text-color-secondary);
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-align: center;
    }
  }

  .gridItem {
    cursor: pointer;
    transition: transform 0.2s ease;
    border: 2px solid transparent;
    border-radius: 6px;
    position: relative;

    &:hover {
      transform: scale(1.03);
      .editBtn {
        z-index: 2;
        opacity: 1;
      }
      .delBtn {
        z-index: 2;
        opacity: 1;
      }
      .preview {
        z-index: 2;
        opacity: 1;
      }
    }

    &.active {
      border-color: var(--td-brand-color);
      position: relative;
      &::after {
        content: "";
        position: absolute;
        inset: 0;
        background-color: #0000006b;
        color: rgb(109, 226, 109);
        line-height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 3rem;
        height: 100%;
      }
    }

    .imageWrapper {
      position: relative;
      overflow: hidden;
      border-radius: 4px;

      .artImage {
        width: 100%;
        aspect-ratio: 1;
        object-fit: cover;
        display: block;
      }

      .text {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: rgba(0, 0, 0, 0.5);
        color: #fff;
        text-align: center;
        padding: 4px;
        font-size: 11px;
        line-height: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
    .editBtn {
      position: absolute;
      top: 6px;
      left: 6px;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
    }
    .delBtn {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
    }
    .preview {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
    }
  }
}

// 视觉手册名称与封面同行布局
.nameAndCoverRow {
  gap: 16px;
  width: 100%;
  .nameField {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .mdFileLocation {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 10px;
  }

  .coverField {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 20px;
  }

  .fieldLabel {
    font-size: 14px;
    color: var(--td-text-color-primary);
  }
}

// 画风弹窗样式
.coverUploadArea {
  width: 100%;

  .coverPreview {
    display: flex;
    align-items: center;
    gap: 12px;

    .coverImg {
      width: 80px;
      height: 80px;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid var(--td-component-border);
    }
  }

  &.multiCoverUploadArea {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: flex-start;

    .coverPreview {
      position: relative;
      flex-shrink: 0;

      .coverImg {
        width: 80px;
        height: 80px;
        object-fit: cover;
        border-radius: 6px;
        border: 1px solid var(--td-component-border);
        display: block;
      }

      .coverImgRemove {
        position: absolute;
        top: -6px;
        right: -6px;
        width: 18px;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--td-error-color);
        color: #fff;
        border-radius: 50%;
        cursor: pointer;
        font-size: 12px;
        z-index: 1;

        &:hover {
          background: var(--td-error-color-hover);
        }
      }
    }
  }

  .coverUploadTrigger {
    width: 80px;
    height: 80px;
    border: 2px dashed var(--td-component-border);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--td-text-color-placeholder);
    gap: 4px;
    font-size: 12px;
    transition: border-color 0.2s;
    white-space: nowrap;

    &:hover {
      border-color: var(--td-brand-color);
      color: var(--td-brand-color);
    }
  }
}

.promptEditorWrapper {
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;

  .promptEditorHeader {
    display: flex;
    margin-bottom: 8px;

    .aiExtractInline {
      width: 100%;
      .aiImageList {
        display: flex;
        align-items: center;
        gap: 4px;

        .aiImageItem {
          position: relative;
          width: 36px;
          height: 36px;

          .aiImg {
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 4px;
            border: 1px solid var(--td-component-border);
          }

          .aiImgRemove {
            position: absolute;
            top: -5px;
            right: -5px;
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--td-error-color);
            color: #fff;
            border-radius: 50%;
            cursor: pointer;
            font-size: 9px;
          }
        }

        .aiImageAdd {
          width: 36px;
          height: 36px;
          border: 2px dashed var(--td-component-border);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--td-text-color-placeholder);
          transition: border-color 0.2s;

          &:hover {
            border-color: var(--td-brand-color);
            color: var(--td-brand-color);
          }
        }
      }
    }
  }
}

// MdEditor 在弹窗内的样式调整
:deep(.md-editor) {
  border-radius: 6px;
}

// 画风弹窗整体高度72vh
:deep(.artStyleDialog) {
  .t-dialog__body {
    height: 75vh;
    overflow-y: auto;
  }
}

// AI 画风解析不到时的阻断提示：必须从内置手册里选一个
.configWarnPanel {
  margin-bottom: 12px;

  .configWarnBody {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .configWarnTitle {
    font-weight: 600;
  }

  .configWarnTip {
    font-size: 12px;
    opacity: 0.85;
  }

  .configWarnOptions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
}
</style>
