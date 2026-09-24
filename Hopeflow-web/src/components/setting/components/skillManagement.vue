<template>
  <div class="skillManagement">
    <!-- 技能总览（卡片） -->
    <section class="overviewPanel">
      <div class="overviewHeader">
        <div class="overviewTitle">
          {{ $t("setting.skillManagement.overview") }}
          <t-tag v-if="issueCount > 0" size="small" theme="danger" variant="light" style="margin-left: 8px">
            {{ $t("setting.skillManagement.configIssue", { count: issueCount }) }}
          </t-tag>
        </div>
        <t-radio-group v-model="kindFilter" variant="default-filled" size="small">
          <t-radio-button value="all">{{ $t("setting.skillManagement.all") }}</t-radio-button>
          <t-radio-button value="art">{{ $t("setting.skillManagement.kindArt") }}</t-radio-button>
          <t-radio-button value="story">{{ $t("setting.skillManagement.kindStory") }}</t-radio-button>
          <t-radio-button value="production">{{ $t("setting.skillManagement.kindProduction") }}</t-radio-button>
          <t-radio-button value="agent">{{ $t("setting.skillManagement.kindAgent") }}</t-radio-button>
        </t-radio-group>
      </div>

      <div class="cardGrid" v-if="filteredPackages.length">
        <t-card
          v-for="pkg in filteredPackages"
          :key="pkg.path"
          class="skillCard"
          :class="{ isDisabled: !pkg.enabled }"
          hoverable
          @click="onCardClick(pkg)"
        >
          <div class="cardBody">
            <div class="cardCover">
              <img v-if="pkg.coverUrl" :src="pkg.coverUrl" :alt="pkg.name" loading="lazy" />
              <div v-else class="coverPlaceholder">
                <i-file-text theme="outline" size="30" />
              </div>
            </div>
            <div class="cardInfo">
              <div class="cardTitle">
                <span class="cardName" :title="pkg.name">{{ pkg.name }}</span>
                <t-tag size="small" theme="primary" variant="light">{{ kindLabel(pkg.kind) }}</t-tag>
                <t-tooltip v-if="pkg.issues.length" :content="issueTooltip(pkg)">
                  <t-badge :count="pkg.issues.length" size="small" theme="danger" />
                </t-tooltip>
              </div>
              <div class="cardDesc" v-if="pkg.description">{{ pkg.description }}</div>
              <div class="cardMeta">
                <span>{{ $t("setting.skillManagement.fileCount", { count: pkg.fileCount }) }}</span>
                <span class="cardAttribution" :title="pkg.attribution">{{ pkg.attribution }}</span>
              </div>
              <div class="cardSwitch">
                <t-switch v-if="pkg.toggleable" :value="pkg.enabled" size="small" @change="(v) => onToggle(pkg, v)" />
                <t-tag v-else size="small" variant="light">{{ $t("setting.skillManagement.enabled") }}</t-tag>
              </div>
            </div>
          </div>
        </t-card>
      </div>
      <t-empty v-else :description="$t('setting.skillManagement.noResult')" />
    </section>

    <!-- 文件编辑区 -->
    <section class="editPanel">
      <aside class="sidebarPanel">
        <div class="sidebarActions">
          <t-input v-model="keyword" clearable :placeholder="$t('setting.skillManagement.searchPh')" @input="onKeywordInput" />
          <t-button size="small" theme="primary" @click="openGenDialog">{{ $t("setting.skillManagement.aiGenerate") }}</t-button>
        </div>
        <div class="treeWrap">
          <t-tree v-if="treeData.length" activable hover line expand-on-click-node :data="treeData" :actived="activedKeys" @active="onTreeActive">
            <template #icon="{ node }">
              <i-folder-open v-if="!node.data.isFile" theme="outline" size="16" />
              <i-file-text v-else-if="node.data.isRoot" theme="outline" size="16" fill="red" />
              <i-file-text v-else theme="outline" size="16" />
            </template>
          </t-tree>
          <t-empty v-else :description="$t('setting.skillManagement.empty')" />
        </div>
      </aside>

      <section class="viewPanel">
        <div v-if="activeEntry" class="viewHeader">
          <span class="fileName">{{ activeEntry }}</span>
          <t-button size="small" theme="primary" variant="outline" @click="openEditDialog">{{ $t("setting.skillManagement.edit") }}</t-button>
        </div>

        <div v-if="activeEntry" class="previewWrap">
          <MdPreview :theme="themeSetting.mode === 'auto' ? 'light' : themeSetting.mode" :modelValue="content" :toolbars="[]" preview-only preview-theme="github" code-theme="atom" />
        </div>

        <t-empty v-else :description="$t('setting.skillManagement.selectOnTheLeft')" />
      </section>
    </section>

    <!-- AI 生成技能：输入描述 + 选择模型 -->
    <t-dialog
      placement="center"
      v-model:visible="genVisible"
      :header="$t('setting.skillManagement.aiGenerate')"
      width="640px"
      :confirm-btn="{ content: $t('setting.skillManagement.generate'), loading: genLoading }"
      :cancel-btn="$t('common.cancel')"
      :confirm-on-enter="false"
      :on-confirm="onGenerate">
      <div class="genForm">
        <t-form label-align="top">
          <t-form-item :label="$t('setting.skillManagement.aiGenerateDesc')" required-mark>
            <t-textarea v-model="genForm.description" :placeholder="$t('setting.skillManagement.aiGenerateDescPh')" :autosize="{ minRows: 2, maxRows: 4 }" />
          </t-form-item>
          <t-form-item :label="$t('setting.skillManagement.aiGenerateType')">
            <t-radio-group v-model="genForm.type">
              <t-radio-button value="auto">{{ $t("setting.skillManagement.typeAuto") }}</t-radio-button>
              <t-radio-button value="art">{{ $t("setting.skillManagement.typeArt") }}</t-radio-button>
              <t-radio-button value="story">{{ $t("setting.skillManagement.typeStory") }}</t-radio-button>
            </t-radio-group>
          </t-form-item>
          <t-form-item :label="$t('setting.skillManagement.selectTextModel')" required-mark>
            <modelSelect v-model="genForm.textModel" v-model:label="genForm.textModelLabel" type="text" />
          </t-form-item>
          <t-form-item :label="$t('setting.skillManagement.selectImageModel')">
            <modelSelect v-model="genForm.imageModel" v-model:label="genForm.imageModelLabel" type="image" />
            <div class="formTip">{{ $t("setting.skillManagement.imageModelTip") }}</div>
          </t-form-item>
        </t-form>
      </div>
    </t-dialog>

    <!-- AI 生成技能：预览确认 -->
    <t-dialog
      placement="center"
      v-model:visible="previewVisible"
      :header="$t('setting.skillManagement.preview')"
      width="90vw"
      :footer="false">
      <div class="previewPanel" v-if="genResult">
        <aside class="previewSidebar">
          <div class="previewTitle">{{ genResult.title }}（{{ genResult.stylePath }}）</div>
          <t-menu :value="previewIndex" @change="onPreviewChange">
            <t-menu-item v-for="(file, idx) in genResult.files" :key="file.path" :value="idx">
              {{ file.path }}
            </t-menu-item>
          </t-menu>
        </aside>
        <section class="previewContent">
          <template v-if="previewIndex === -1">
            <div class="coverWrap" v-if="genResult.imageBase64">
              <img :src="genResult.imageBase64" class="coverImg" alt="cover" />
            </div>
            <t-empty v-else :description="$t('setting.skillManagement.noCover')" />
          </template>
          <template v-else>
            <div class="previewToolbar">
              <span class="fileName">{{ genResult.files[previewIndex]?.path }}</span>
              <t-button size="small" theme="primary" variant="outline" @click="openGenEdit">{{ $t("setting.skillManagement.edit") }}</t-button>
            </div>
            <div class="previewMd">
              <MdPreview :theme="themeSetting.mode === 'auto' ? 'light' : themeSetting.mode" :modelValue="genResult.files[previewIndex]?.content || ''" :toolbars="[]" preview-only preview-theme="github" code-theme="atom" />
            </div>
          </template>
        </section>
      </div>
      <div class="previewFooter">
        <t-button theme="primary" :loading="saving" @click="onConfirmSave">{{ $t("setting.skillManagement.confirmSave") }}</t-button>
      </div>
    </t-dialog>

    <!-- AI 生成技能：单文件编辑 -->
    <t-dialog
      placement="center"
      v-model:visible="genEditVisible"
      :header="$t('setting.skillManagement.edit') + ' ' + (genResult?.files[previewIndex]?.path || '')"
      width="80vw"
      :confirm-btn="$t('common.save')"
      :confirm-on-enter="false"
      :on-confirm="onGenEditSave">
      <MdEditor :theme="themeSetting.mode === 'auto' ? 'light' : themeSetting.mode" v-model="genDraft" :toolbars="mdToolbars" preview-theme="github" code-theme="atom" style="height: 72vh" />
    </t-dialog>

    <!-- 技能文件编辑 -->
    <t-dialog
      placement="center"
      v-model:visible="editVisible"
      :header="$t('setting.skillManagement.edit') + ' ' + (activeEntry || '')"
      width="80vw"
      :confirm-btn="{ content: $t('common.save'), loading: isSaving }"
      :cancel-btn="$t('common.cancel')"
      :confirm-on-enter="false"
      :on-confirm="onSave">
      <MdEditor :theme="themeSetting.mode === 'auto' ? 'light' : themeSetting.mode" v-model="draft" :toolbars="mdToolbars" preview-theme="github" code-theme="atom" style="height: 72vh" />
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { MdEditor, MdPreview } from "md-editor-v3";
import type { ToolbarNames } from "md-editor-v3";
import settingStore from "@/stores/setting";
const { themeSetting } = storeToRefs(settingStore());
import type { TreeNodeModel, TreeNodeValue, TreeOptionData } from "tdesign-vue-next";
import axios from "@/utils/axios";
import modelSelect from "@/components/modelSelect.vue";

const mdToolbars: ToolbarNames[] = [
  "bold",
  "underline",
  "italic",
  "strikeThrough",
  "-",
  "title",
  "sub",
  "sup",
  "quote",
  "unorderedList",
  "orderedList",
  "task",
  "-",
  "codeRow",
  "code",
  "table",
  "-",
  "revoke",
  "next",
  "=",
  "preview",
];

interface TreeItem {
  label: string;
  value: string;
  children?: TreeItem[];
  isFile?: boolean;
  isRoot?: boolean;
}

interface SkillPackage {
  kind: "art" | "story" | "production" | "agent";
  path: string;
  name: string;
  description: string;
  coverUrl: string;
  fileCount: number;
  enabled: boolean;
  toggleable: boolean;
  attribution: string;
  issues: { path: string; reason: string }[];
  files: string[];
}

const entries = ref<string[]>([]);
const activeEntry = ref("");
const keyword = ref("");
const content = ref("");
const draft = ref("");
const editVisible = ref(false);
const isSaving = ref(false);

// ── 技能总览（卡片）状态 ──
const packages = ref<SkillPackage[]>([]);
const kindFilter = ref("all");
const issueCount = ref(0);
const searchResults = ref<Record<string, boolean>>({});

const kindLabels: Record<string, string> = {
  art: $t("setting.skillManagement.kindArt"),
  story: $t("setting.skillManagement.kindStory"),
  production: $t("setting.skillManagement.kindProduction"),
  agent: $t("setting.skillManagement.kindAgent"),
};

function kindLabel(kind: string): string {
  return kindLabels[kind] || kind;
}

function issueTooltip(pkg: SkillPackage): string {
  return pkg.issues.map((i) => `${i.path}：${i.reason}`).join("\n");
}

const filteredPackages = computed(() => {
  let list = packages.value;
  if (kindFilter.value !== "all") list = list.filter((p) => p.kind === kindFilter.value);
  const kw = keyword.value.trim();
  if (kw) {
    const lower = kw.toLowerCase();
    list = list.filter(
      (p) =>
        p.files.some((f) => searchResults.value[f]) ||
        p.name.toLowerCase().includes(lower) ||
        p.description.toLowerCase().includes(lower),
    );
  }
  return list;
});

const activedKeys = computed(() => (activeEntry.value ? [activeEntry.value] : []));

const filteredEntries = computed(() => {
  let result = entries.value.filter((e) => e.endsWith(".md"));
  const kw = keyword.value.trim();
  if (kw) {
    result = result.filter((e) => searchResults.value[e]);
  }
  return result;
});

const treeData = computed<TreeItem[]>(() => {
  const dirMap = new Map<string, TreeItem>();
  const rootItems: TreeItem[] = [];

  for (const filePath of filteredEntries.value) {
    const parts = filePath.split("/").filter(Boolean);
    let parentChildren = rootItems;
    let cur = "";

    for (let i = 0; i < parts.length; i++) {
      cur = cur ? `${cur}/${parts[i]}` : parts[i];
      const isFile = i === parts.length - 1;

      if (isFile) {
        if (!parentChildren.some((c) => c.value === cur)) {
          parentChildren.push({ label: parts[i], value: cur, isFile: true, isRoot: parts.length === 1 });
        }
      } else {
        let dir = dirMap.get(cur);
        if (!dir) {
          dir = { label: parts[i], value: cur, isFile: false, children: [] };
          dirMap.set(cur, dir);
          parentChildren.push(dir);
        }
        parentChildren = dir.children!;
      }
    }
  }

  const sortItems = (items: TreeItem[]) => {
    items.sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.label.localeCompare(b.label);
    });
    items.forEach((item) => item.children && sortItems(item.children));
  };
  sortItems(rootItems);

  return rootItems;
});

async function fetchList() {
  try {
    const { data } = await axios.post("/setting/skillManagement/getSkillList");
    entries.value = Array.isArray(data) ? data : [];
  } catch (e) {
    console.error(e);
  }
}

async function fetchPackages() {
  try {
    const { data } = await axios.post("/setting/skillManagement/getSkillPackages");
    packages.value = data?.packages ?? [];
    issueCount.value = data?.summary?.issueCount ?? 0;
  } catch (e) {
    console.error(e);
  }
}

async function loadContent(path: string) {
  try {
    const { data } = await axios.post("/setting/skillManagement/getSkillContent", { path });
    content.value = typeof data === "string" ? data : data?.content || "";
  } catch (e) {
    console.error(e);
    content.value = "";
  }
}

async function onTreeActive(value: TreeNodeValue[], context: { node: TreeNodeModel<TreeOptionData> }) {
  const key = value[value.length - 1];
  const path = typeof key === "string" ? key : String(key || "");
  const node = context.node.data as TreeItem | undefined;
  if (!path || !node?.isFile || path === activeEntry.value) return;
  activeEntry.value = path;
  await loadContent(path);
}

function openEditDialog() {
  draft.value = content.value;
  editVisible.value = true;
}

async function onSave() {
  if (!activeEntry.value) return;
  isSaving.value = true;
  try {
    await axios.post("/setting/skillManagement/saveSkillContent", {
      path: activeEntry.value,
      content: draft.value,
    });
    content.value = draft.value;
    editVisible.value = false;
  } catch (e) {
    console.error(e);
  } finally {
    isSaving.value = false;
  }
}

// ── 搜索（文件名 + 内容，防抖） ──
let searchTimer: ReturnType<typeof setTimeout> | null = null;
async function onKeywordInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const kw = keyword.value.trim();
    if (!kw) {
      searchResults.value = {};
      return;
    }
    try {
      const { data } = await axios.post("/setting/skillManagement/searchSkillFiles", { keyword: kw });
      const map: Record<string, boolean> = {};
      (Array.isArray(data) ? data : []).forEach((r: { path: string }) => (map[r.path] = true));
      searchResults.value = map;
    } catch (e) {
      console.error(e);
      searchResults.value = {};
    }
  }, 300);
}

// ── 卡片操作 ──
async function onCardClick(pkg: SkillPackage) {
  const readme = pkg.files.find((f) => f.endsWith("README.md")) || pkg.files[0];
  if (!readme) return;
  activeEntry.value = readme;
  await loadContent(readme);
}

async function onToggle(pkg: SkillPackage, enabled: boolean) {
  try {
    await axios.post("/setting/skillManagement/toggleSkillEnabled", { path: pkg.path, enabled });
    pkg.enabled = enabled;
  } catch (e) {
    console.error(e);
    window.$message.error((e as any)?.message ?? $t("setting.skillManagement.msg.toggleFailed"));
  }
}

// ==================== AI 生成技能 ====================
interface GeneratedFile {
  path: string;
  content: string;
}
interface GenResult {
  type: "art" | "story";
  stylePath: string;
  title: string;
  files: GeneratedFile[];
  imageBase64: string;
}

const genVisible = ref(false);
const genLoading = ref(false);
const genForm = ref({ description: "", type: "auto", textModel: "", textModelLabel: "", imageModel: "", imageModelLabel: "" });
const previewVisible = ref(false);
const previewIndex = ref(-1);
const genResult = ref<GenResult | null>(null);
const saving = ref(false);
const genEditVisible = ref(false);
const genDraft = ref("");

function openGenDialog() {
  genVisible.value = true;
}

// 变更预览文件选择（菜单 value 即文件索引）
function onPreviewChange(value: TreeNodeValue) {
  previewIndex.value = typeof value === "number" ? value : Number(value);
}

async function onGenerate() {
  if (!genForm.value.description.trim()) {
    window.$message.warning($t("setting.skillManagement.msg.descRequired"));
    return;
  }
  if (!genForm.value.textModel) {
    window.$message.warning($t("setting.skillManagement.msg.textModelRequired"));
    return;
  }
  genLoading.value = true;
  try {
    const { data } = await axios.post("/setting/skillManagement/generateSkill", {
      description: genForm.value.description.trim(),
      type: genForm.value.type,
      textModel: genForm.value.textModel,
      imageModel: genForm.value.imageModel || undefined,
    });
    genResult.value = {
      type: data.type,
      stylePath: data.stylePath,
      title: data.title,
      files: data.files,
      imageBase64: data.imageBase64,
    };
    previewIndex.value = 0;
    genVisible.value = false;
    previewVisible.value = true;
  } catch (e) {
    console.error(e);
  } finally {
    genLoading.value = false;
  }
}

function openGenEdit() {
  if (previewIndex.value < 0 || !genResult.value) return;
  genDraft.value = genResult.value.files[previewIndex.value].content;
  genEditVisible.value = true;
}

function onGenEditSave() {
  if (previewIndex.value < 0 || !genResult.value) return;
  genResult.value.files[previewIndex.value].content = genDraft.value;
  genEditVisible.value = false;
}

async function onConfirmSave() {
  if (!genResult.value) return;
  saving.value = true;
  try {
    await axios.post("/setting/skillManagement/saveGeneratedSkill", {
      type: genResult.value.type,
      stylePath: genResult.value.stylePath,
      files: genResult.value.files,
      images: genResult.value.imageBase64 ? [genResult.value.imageBase64] : [],
    });
    window.$message.success($t("setting.skillManagement.msg.generateSuccess"));
    previewVisible.value = false;
    genResult.value = null;
    await fetchList();
    await fetchPackages();
  } catch (e) {
    console.error(e);
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  fetchList();
  fetchPackages();
});
</script>

<style lang="scss" scoped>
.skillManagement {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;

  // ── 技能总览（卡片） ──
  .overviewPanel {
    flex: 0 0 auto;
    max-height: 45%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border: 1px solid var(--td-component-stroke);
    border-radius: 8px;
    overflow: hidden;

    .overviewHeader {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;

      .overviewTitle {
        font-size: 14px;
        font-weight: 600;
        white-space: nowrap;
      }
    }

    .cardGrid {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
      gap: 10px;
      overflow: auto;
      padding-right: 4px;
    }

    .skillCard {
      cursor: pointer;

      &.isDisabled {
        opacity: 0.6;
      }

      :deep(.t-card__body) {
        padding: 10px;
      }

      .cardBody {
        display: flex;
        gap: 10px;
        min-height: 96px;
      }

      .cardCover {
        flex-shrink: 0;
        width: 76px;
        height: 96px;
        border-radius: 6px;
        overflow: hidden;
        background: var(--td-bg-color-component);
        display: flex;
        align-items: center;
        justify-content: center;

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .coverPlaceholder {
          color: var(--td-text-color-placeholder);
        }
      }

      .cardInfo {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .cardTitle {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;

        .cardName {
          flex: 1;
          min-width: 0;
          font-size: 14px;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }

      .cardDesc {
        font-size: 12px;
        color: var(--td-text-color-secondary);
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .cardMeta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 12px;
        color: var(--td-text-color-placeholder);

        .cardAttribution {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: right;
        }
      }

      .cardSwitch {
        display: flex;
        align-items: center;
      }
    }
  }

  // ── 文件编辑区 ──
  .editPanel {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 300px minmax(0, 1fr);
    gap: 12px;

    .sidebarPanel {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px;
      border: 1px solid var(--td-component-stroke);
      border-radius: 8px;
      overflow: hidden;
      min-height: 0;

      .sidebarActions {
        display: flex;
        align-items: center;
        gap: 8px;

        .t-input {
          flex: 1;
        }

        .t-button {
          flex-shrink: 0;
        }
      }

      .treeWrap {
        flex: 1;
        overflow: auto;
        user-select: none;
      }
    }

    .viewPanel {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--td-component-stroke);
      border-radius: 8px;
      overflow: hidden;

      .viewHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 16px;
        border-bottom: 1px solid var(--td-component-stroke);

        .fileName {
          font-size: 14px;
          font-weight: 600;
          word-break: break-all;
        }
      }

      .previewWrap {
        flex: 1;
        overflow: auto;
        padding: 12px 16px;
      }
    }
  }

  .genForm {
    .formTip {
      margin-top: 6px;
      font-size: 12px;
      color: var(--td-text-color-placeholder);
      line-height: 1.5;
    }
  }

  .previewPanel {
    display: grid;
    grid-template-columns: 300px minmax(0, 1fr);
    gap: 12px;
    height: 60vh;
    min-height: 0;

    .previewSidebar {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--td-component-stroke);
      border-radius: 8px;
      overflow: hidden;
      min-height: 0;

      .previewTitle {
        padding: 10px 12px;
        font-size: 14px;
        font-weight: 600;
        border-bottom: 1px solid var(--td-component-stroke);
        word-break: break-all;
      }

      .t-menu {
        flex: 1;
        overflow: auto;
      }
    }

    .previewContent {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--td-component-stroke);
      border-radius: 8px;
      overflow: hidden;
      min-height: 0;

      .previewToolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 16px;
        border-bottom: 1px solid var(--td-component-stroke);

        .fileName {
          font-size: 14px;
          font-weight: 600;
          word-break: break-all;
        }
      }

      .coverWrap {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        overflow: auto;

        .coverImg {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          border-radius: 8px;
        }
      }

      .previewMd {
        flex: 1;
        overflow: auto;
        padding: 12px 16px;
      }
    }
  }

  .previewFooter {
    display: flex;
    justify-content: flex-end;
    padding-top: 16px;
  }
}
</style>
