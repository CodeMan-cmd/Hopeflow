<template>
  <div class="knowledge" v-loading="loading">
    <!-- 顶部工具条 -->
    <PageToolbar :title="$t('workbench.knowledge.title')" :subtitle="$t('workbench.knowledge.subtitle')" />

    <!-- 类型分类 Tabs -->
    <t-tabs v-model="typeFilter" class="typeTabs">
      <t-tab-panel v-for="tab in typeTabs" :key="tab.value" :value="tab.value">
        <template #label>
          <div class="tabLabel">
            <span>{{ tab.label }}</span>
            <span class="tabCount">{{ tab.count }}</span>
          </div>
        </template>
      </t-tab-panel>
    </t-tabs>

    <!-- 操作工具条 -->
    <div class="filterBar f ac jb">
      <div class="f ac" style="gap: var(--app-space-2)">
        <t-dropdown :min-column-width="130" @click="onExportAction">
          <t-button variant="outline">
            <template #icon><i-download :size="16" /></template>
            {{ $t("workbench.knowledge.export") }}
          </t-button>
          <template #dropdown>
            <t-dropdown-menu>
              <t-dropdown-item value="copy">
                <template #prefix-icon><i-copy :size="16" /></template>
                {{ $t("workbench.knowledge.exportCopy") }}
              </t-dropdown-item>
              <t-dropdown-item value="download">
                <template #prefix-icon><i-download-one :size="16" /></template>
                {{ $t("workbench.knowledge.exportDownload") }}
              </t-dropdown-item>
            </t-dropdown-menu>
          </template>
        </t-dropdown>
        <t-button variant="outline" @click="openImport">
          <template #icon><i-upload :size="16" /></template>
          {{ $t("workbench.knowledge.import") }}
        </t-button>
        <t-button theme="primary" @click="openDialog()">
          <template #icon><i-add :size="16" /></template>
          {{ $t("workbench.knowledge.add") }}
        </t-button>
      </div>
      <div class="f ac">
        <t-input v-model="searchText" :placeholder="$t('workbench.knowledge.searchPh')" clearable style="width: 260px" @enter="handleSearch" @clear="handleClear" />
        <t-button theme="primary" style="margin-left: var(--app-space-2)" @click="handleSearch">
          <template #icon><i-search :size="16" /></template>
          {{ $t("workbench.knowledge.search") }}
        </t-button>
      </div>
    </div>

    <!-- 表格容器 -->
    <t-card class="tableCard" :bordered="false">
      <t-table :data="filteredList" :columns="columns" row-key="id" :loading="loading" hover stripe table-layout="fixed">
        <template #empty>
          <AppEmpty :description="$t('workbench.knowledge.empty')">
            <template #action>
              <t-button theme="primary" @click="openDialog()">
                <template #icon><i-add :size="16" /></template>
                {{ $t("workbench.knowledge.add") }}
              </t-button>
            </template>
          </AppEmpty>
        </template>
        <template #type="{ row }">
          <t-tag size="small" variant="light" :theme="typeTheme(row.type)">{{ typeLabel(row.type) }}</t-tag>
        </template>
        <template #content="{ row }">
          <span class="contentCell" :title="row.content">{{ row.content }}</span>
        </template>
        <template #updatedAt="{ row }">
          <span class="timeCell">{{ formatTime(row.updatedAt) }}</span>
        </template>
        <template #operation="{ row }">
          <t-button size="small" variant="outline" theme="primary" @click="openDialog(row)">
            <template #icon><i-edit :size="14" /></template>
            {{ $t("workbench.knowledge.edit") }}
          </t-button>
          <t-popconfirm :content="$t('workbench.knowledge.deleteConfirm')" @confirm="onDelete(row)">
            <t-button size="small" variant="text" theme="danger">
              <template #icon><i-delete :size="14" /></template>
              {{ $t("workbench.knowledge.delete") }}
            </t-button>
          </t-popconfirm>
        </template>
      </t-table>
    </t-card>

    <!-- 新增/编辑弹窗 -->
    <t-dialog
      v-model:visible="dialogVisible"
      :header="(form.id ? $t('workbench.knowledge.edit') : $t('workbench.knowledge.add')) + ' ' + $t('workbench.knowledge.title')"
      width="560px"
      :confirm-btn="{ content: $t('common.save'), loading: saving }"
      :cancel-btn="$t('common.cancel')"
      :confirm-on-enter="false"
      :on-confirm="onSave">
      <t-form label-align="top">
        <t-form-item :label="$t('workbench.knowledge.typeLabel')">
          <t-select v-model="form.type" :options="typeOptions" />
        </t-form-item>
        <t-form-item :label="$t('workbench.knowledge.titleLabel')" required-mark>
          <t-input v-model="form.title" :placeholder="$t('workbench.knowledge.titlePh')" />
        </t-form-item>
        <t-form-item :label="$t('workbench.knowledge.contentLabel')" required-mark>
          <t-textarea v-model="form.content" :autosize="{ minRows: 4, maxRows: 10 }" :placeholder="$t('workbench.knowledge.contentPh')" />
        </t-form-item>
      </t-form>
    </t-dialog>

    <!-- 导入弹窗 -->
    <t-dialog
      v-model:visible="importVisible"
      :header="$t('workbench.knowledge.importDialogTitle')"
      width="640px"
      :confirm-btn="{ content: $t('workbench.knowledge.importConfirm'), loading: importing, disabled: !importPreview.items.length }"
      :cancel-btn="$t('common.cancel')"
      :confirm-on-enter="false"
      :on-confirm="doImport"
      destroy-on-close>
      <p class="importDesc">{{ $t("workbench.knowledge.importDesc") }}</p>
      <div class="importSection">
        <div class="importLabel">{{ $t("workbench.knowledge.importFile") }}</div>
        <t-upload
          :auto-upload="false"
          :multiple="false"
          accept=".txt,.md,.json"
          theme="file-input"
          :show-upload-progress="false"
          :placeholder="$t('workbench.knowledge.importFilePh')"
          @change="onFileChange" />
      </div>
      <div class="importSection">
        <div class="importLabel">{{ $t("workbench.knowledge.importPaste") }}</div>
        <t-textarea v-model="importText" :placeholder="$t('workbench.knowledge.importPastePh')" :autosize="{ minRows: 5, maxRows: 10 }" />
      </div>
      <div v-if="importPreview.items.length" class="importPreview">
        <t-alert :message="$t('workbench.knowledge.importPreview', { total: importPreview.items.length, skipped: importPreview.skipped })" theme="info" :close="false" />
        <div class="previewList">
          <div class="previewItem" v-for="(it, idx) in importPreview.items" :key="idx">
            <t-tag size="small" variant="light" :theme="typeTheme(it.type)">{{ typeLabel(it.type) }}</t-tag>
            <span class="previewTitle" :title="it.title">{{ it.title }}</span>
          </div>
        </div>
      </div>
      <t-alert v-else-if="importPreview.skipped" :message="$t('workbench.knowledge.parseFailed')" theme="warning" :close="false" class="importPreview" />
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import dayjs from "dayjs";
import axios from "@/utils/axios";
import projectStore from "@/stores/project";
import AppEmpty from "@/components/feedback/AppEmpty.vue";
import pageToolbar from "@/components/pageToolbar.vue";
import type { TableProps } from "tdesign-vue-next";

const { project } = storeToRefs(projectStore());

interface KnowledgeItem {
  id: number;
  projectId: number;
  type: string;
  title: string;
  content: string;
  updatedAt: number;
}

interface ImportItem {
  type: string;
  title: string;
  content: string;
}

const loading = ref(false);
const saving = ref(false);
const importing = ref(false);
const list = ref<KnowledgeItem[]>([]);
const typeFilter = ref("all");
const searchText = ref("");
const searchKeyword = ref("");
const dialogVisible = ref(false);
const form = ref<Partial<KnowledgeItem>>({});
const importVisible = ref(false);
const importText = ref("");

const typeOptions = [
  { label: $t("workbench.knowledge.typeWorld"), value: "world" },
  { label: $t("workbench.knowledge.typeCharacter"), value: "character" },
  { label: $t("workbench.knowledge.typeTerm"), value: "term" },
  { label: $t("workbench.knowledge.typeOther"), value: "other" },
];

// 导出文本中的中文类型标签（固定，与 UI 语言无关），用于导入解析
const TYPE_LABEL_MAP: Record<string, string> = {
  world: "世界观",
  character: "人物",
  term: "术语",
  other: "其他",
};

function typeLabel(type: string): string {
  return typeOptions.find((t) => t.value === type)?.label ?? type;
}

function typeTheme(type: string): "primary" | "success" | "warning" | "default" {
  const themes: Record<string, "primary" | "success" | "warning" | "default"> = {
    world: "primary",
    character: "success",
    term: "warning",
    other: "default",
  };
  return themes[type] ?? "default";
}

// 类型分类 Tabs：全部 + 各类型数量
const typeTabs = computed(() => {
  const counter: Record<string, number> = { all: list.value.length };
  typeOptions.forEach((t) => (counter[t.value] = 0));
  list.value.forEach((i) => {
    counter[i.type] = (counter[i.type] ?? 0) + 1;
  });
  return [
    { value: "all", label: $t("workbench.knowledge.typeAll"), count: counter["all"] },
    ...typeOptions.map((t) => ({ value: t.value, label: t.label, count: counter[t.value] })),
  ];
});

const filteredList = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase();
  return list.value.filter((i) => {
    if (typeFilter.value !== "all" && i.type !== typeFilter.value) return false;
    if (kw && !`${i.title}\n${i.content}`.toLowerCase().includes(kw)) return false;
    return true;
  });
});

// 搜索：输入后点击按钮/回车生效；清空输入时同步清除生效关键词
function handleSearch() {
  searchKeyword.value = searchText.value.trim();
}
function handleClear() {
  searchKeyword.value = "";
}

const columns: TableProps["columns"] = [
  { colKey: "title", title: $t("workbench.knowledge.titleLabel"), width: 220, ellipsis: true },
  { colKey: "type", title: $t("workbench.knowledge.typeLabel"), width: 110, cell: "type" },
  { colKey: "content", title: $t("workbench.knowledge.contentLabel"), cell: "content" },
  { colKey: "updatedAt", title: $t("workbench.knowledge.timeLabel"), width: 160, cell: "updatedAt" },
  { colKey: "operation", title: $t("workbench.knowledge.operation"), width: 170, cell: "operation", fixed: "right" },
];

function formatTime(ts?: number): string {
  if (!ts) return "-";
  return dayjs(ts).format("YYYY-MM-DD HH:mm");
}

async function loadList() {
  loading.value = true;
  try {
    const { data } = await axios.get("/knowledge/list", {
      params: { projectId: project.value?.id },
    });
    list.value = data ?? [];
  } catch (e) {
    console.error(e);
    window.$message.error($t("workbench.knowledge.fetchFailed"));
  } finally {
    loading.value = false;
  }
}

function openDialog(item?: KnowledgeItem) {
  form.value = item ? { ...item } : { type: "world", title: "", content: "" };
  dialogVisible.value = true;
}

async function onSave() {
  if (!form.value.title?.trim()) {
    window.$message.warning($t("workbench.knowledge.titleRequired"));
    return;
  }
  if (!form.value.content?.trim()) {
    window.$message.warning($t("workbench.knowledge.contentRequired"));
    return;
  }
  saving.value = true;
  try {
    const payload = {
      projectId: form.value.projectId ?? project.value?.id,
      type: form.value.type ?? "other",
      title: form.value.title.trim(),
      content: form.value.content.trim(),
    };
    if (form.value.id) {
      await axios.post("/knowledge/update", { id: form.value.id, ...payload });
    } else {
      await axios.post("/knowledge/add", payload);
    }
    window.$message.success($t("workbench.knowledge.saveSuccess"));
    dialogVisible.value = false;
    loadList();
  } catch (e) {
    console.error(e);
  } finally {
    saving.value = false;
  }
}

async function onDelete(item: KnowledgeItem) {
  try {
    await axios.post("/knowledge/delete", { id: item.id });
    window.$message.success($t("workbench.knowledge.deleteSuccess"));
    loadList();
  } catch (e) {
    console.error(e);
  }
}

// ===== 导出：复制文本 / 下载文件 =====
async function fetchExportText(): Promise<string | null> {
  const { data } = await axios.get("/knowledge/export", {
    params: { projectId: project.value?.id },
  });
  if (!data) {
    window.$message.warning($t("workbench.knowledge.empty"));
    return null;
  }
  return data;
}

async function onExportCopy() {
  const text = await fetchExportText();
  if (text === null) return;
  try {
    await navigator.clipboard?.writeText(text);
    window.$message.success($t("workbench.knowledge.exportSuccess"));
  } catch (e) {
    console.error(e);
  }
}

async function onExportDownload() {
  const text = await fetchExportText();
  if (text === null) return;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `知识库设定-${project.value?.name ?? "project"}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  window.$message.success($t("workbench.knowledge.exportDownloadSuccess"));
}

function onExportAction(item: any) {
  const v = item?.value;
  if (v === "copy") onExportCopy();
  else if (v === "download") onExportDownload();
}

// ===== 导入：文件 / 粘贴文本 → 解析 → 预览 → 提交 =====
function openImport() {
  importText.value = "";
  importVisible.value = true;
}

function onFileChange(files: any[]) {
  const raw = files?.[0]?.raw;
  if (!raw) return;
  const reader = new FileReader();
  reader.onload = (e: any) => {
    importText.value = String(e.target?.result ?? "");
  };
  reader.readAsText(raw);
}

function parseTypeKey(raw: string): string {
  const key = typeOptions.find((t) => t.value === raw || TYPE_LABEL_MAP[t.value] === raw);
  return key?.value ?? "other";
}

function parseImportText(text: string): { items: ImportItem[]; skipped: number } {
  const trimmed = text.trim();
  if (!trimmed) return { items: [], skipped: 0 };

  // 兼容 JSON 数组格式：[{ type, title, content }]
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr)) {
        const items: ImportItem[] = [];
        let skipped = 0;
        arr.forEach((raw: any) => {
          const title = String(raw?.title ?? "").trim();
          const content = String(raw?.content ?? "").trim();
          if (title && content) {
            items.push({ type: parseTypeKey(String(raw?.type ?? "")), title, content });
          } else {
            skipped++;
          }
        });
        return { items, skipped };
      }
    } catch {
      // JSON 解析失败则按导出文本格式继续解析
    }
  }

  // 导出文本格式：空行分段，首行【类型】标题，其余行为内容
  const items: ImportItem[] = [];
  let skipped = 0;
  trimmed.split(/\n\s*\n/).forEach((block) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const first = lines[0];
    const m = first.match(/^【(.+?)】\s*(.*)$/);
    let type = "other";
    let title: string;
    let contentLines: string[];
    if (m) {
      type = parseTypeKey(m[1].trim());
      title = m[2].trim();
      contentLines = lines.slice(1);
    } else {
      title = first;
      contentLines = lines.slice(1);
    }
    const content = contentLines.join("\n").trim();
    if (title && content) {
      items.push({ type, title, content });
    } else {
      skipped++;
    }
  });
  return { items, skipped };
}

const importPreview = computed(() => parseImportText(importText.value));

async function doImport() {
  const items = importPreview.value.items;
  if (!items.length) return;
  importing.value = true;
  try {
    const { data } = await axios.post("/knowledge/import", {
      projectId: project.value?.id,
      items,
    });
    window.$message.success(
      $t("workbench.knowledge.importSuccess", { imported: data?.imported ?? 0, skipped: data?.skipped ?? 0 }),
    );
    importVisible.value = false;
    importText.value = "";
    loadList();
  } catch (e) {
    console.error(e);
  } finally {
    importing.value = false;
  }
}

onMounted(loadList);
</script>

<style lang="scss" scoped>
.knowledge {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);

  // 类型分类 Tabs（仅作筛选栏，隐藏面板体）
  .typeTabs {
    :deep(.t-tabs__content) {
      display: none;
    }

    .tabLabel {
      display: flex;
      align-items: center;
      gap: var(--app-space-2);

      .tabCount {
        min-width: 20px;
        padding: 0 6px;
        height: 18px;
        line-height: 18px;
        text-align: center;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        color: var(--td-text-color-secondary);
        background: var(--td-bg-color-secondarycontainer);
        border-radius: 9px;
      }
    }
  }

  // 操作工具条（按钮左、搜索右）
  .filterBar {
    gap: var(--app-space-3);
    flex-wrap: wrap;
  }

  // 表格容器
  .tableCard {
    :deep(.t-card__body) {
      padding: 0;
    }
  }

  .contentCell {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 520px;
    color: var(--td-text-color-secondary);
    font-size: 13px;
  }

  .timeCell {
    font-size: 13px;
    color: var(--td-text-color-secondary);
    font-variant-numeric: tabular-nums;
  }

  // 导入弹窗
  .importDesc {
    margin: 0 0 var(--app-space-3);
    font-size: 13px;
    color: var(--td-text-color-secondary);
    line-height: 1.6;
  }

  .importSection {
    margin-bottom: var(--app-space-3);

    .importLabel {
      margin-bottom: var(--app-space-2);
      font-size: 14px;
      font-weight: 500;
      color: var(--td-text-color-primary);
    }
  }

  .importPreview {
    margin-top: var(--app-space-3);

    .previewList {
      margin-top: var(--app-space-2);
      max-height: 180px;
      overflow-y: auto;
      border: 1px solid var(--td-border-level-1-color);
      border-radius: var(--td-radius-medium);
      padding: var(--app-space-1);

      .previewItem {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border-radius: var(--td-radius-small);

        &:hover {
          background-color: var(--td-bg-color-container-hover);
        }

        .previewTitle {
          font-size: 13px;
          color: var(--td-text-color-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    }
  }
}
</style>
