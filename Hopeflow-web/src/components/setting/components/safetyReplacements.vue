<template>
  <div class="safetyReplacements">
    <div class="vendorSelectRow">
      <span class="label">{{ $t("settings.safetyReplacements.vendor") }}</span>
      <t-select
        v-model="activeVendorId"
        :options="vendorOptions"
        :loading="loading"
        style="width: 240px"
        :placeholder="$t('settings.safetyReplacements.selectVendor')"
        @change="handleVendorChange" />
    </div>

    <t-alert theme="info" :message="$t('settings.safetyReplacements.intro')" style="margin: 12px 0" />

    <div class="ruleAddRow">
      <t-input v-model="newFrom" :placeholder="$t('settings.safetyReplacements.fromPlaceholder')" style="width: 220px" clearable />
      <span class="arrow">→</span>
      <t-input v-model="newTo" :placeholder="$t('settings.safetyReplacements.toPlaceholder')" style="width: 220px" clearable />
      <t-button theme="primary" :loading="adding" @click="handleAddRule">
        <template #icon><t-icon name="add" /></template>
        {{ $t("settings.safetyReplacements.addRule") }}
      </t-button>
      <t-button variant="outline" :loading="importing" @click="handleImportBuiltin">
        <template #icon><t-icon name="download" /></template>
        {{ $t("settings.safetyReplacements.importBuiltin") }}
      </t-button>
      <t-button variant="outline" :loading="importingExternal" @click="triggerFileSelect">
        <template #icon><t-icon name="upload" /></template>
        {{ $t("settings.safetyReplacements.importExternal") }}
      </t-button>
      <t-button variant="outline" @click="handleExport">
        <template #icon><t-icon name="file-export" /></template>
        {{ $t("settings.safetyReplacements.exportRules") }}
      </t-button>
      <t-button variant="outline" @click="handleDownloadTemplate">
        <template #icon><t-icon name="file-copy" /></template>
        {{ $t("settings.safetyReplacements.importTemplate") }}
      </t-button>
      <input ref="fileInputRef" type="file" accept=".json,application/json" style="display: none" @change="handleImportFile" />
    </div>

    <t-table
      :data="rules"
      :columns="columns"
      :loading="loadingRules"
      row-key="id"
      style="margin-top: 16px" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h, onMounted } from "vue";
import { Input as TInput, Switch as TSwitch, Button as TButton } from "tdesign-vue-next";
import axios from "@/utils/axios";

interface SafetyRule {
  id: number;
  vendorId: string;
  replaceFrom: string;
  replaceTo: string;
  enabled: number;
  createTime: number;
  updateTime: number;
}

// 内置建议规则：AutoDL 等平台内容安全审核易误判的常见美术/画面术语（长词在前，避免子串被先行替换）
const BUILTIN_RULES: [string, string][] = [
  ["日式动画渲染", "动漫渲染"],
  ["日式动画", "动漫动画"],
  ["日式渲染", "动漫渲染"],
  ["动画渲染", "动漫渲染"],
  ["东方奇幻电影", "东方奇幻影视"],
  ["电影质感", "影视质感"],
  ["电影级", "影视级"],
  ["电影风格", "影视风格"],
  ["电影构图", "影视构图"],
  ["电影感", "影视感"],
  ["在黑暗中", "在暗处"],
];

const vendorList = ref<any[]>([]);
const vendorOptions = computed(() => vendorList.value.map((v: any) => ({ label: v.name, value: v.id })));
const activeVendorId = ref("");
const loading = ref(false);

const rules = ref<SafetyRule[]>([]);
const loadingRules = ref(false);
const newFrom = ref("");
const newTo = ref("");
const adding = ref(false);
const importing = ref(false);

async function getVendorList() {
  loading.value = true;
  try {
    const res: any = await axios.post("/setting/vendorConfig/getVendorList");
    vendorList.value = res.data || [];
    if (vendorList.value.length) {
      activeVendorId.value = vendorList.value[0].id;
      await loadRules();
    }
  } catch (err: any) {
    window.$message?.error(err?.message || $t("settings.safetyReplacements.getVendorsFailed"));
  } finally {
    loading.value = false;
  }
}

async function loadRules() {
  if (!activeVendorId.value) return;
  loadingRules.value = true;
  try {
    const res: any = await axios.post("/setting/safetyReplacements/getList", { vendorId: activeVendorId.value });
    rules.value = res.data || [];
  } catch (err: any) {
    window.$message?.error(err?.message || $t("settings.safetyReplacements.getRulesFailed"));
  } finally {
    loadingRules.value = false;
  }
}

function handleVendorChange() {
  void loadRules();
}

async function handleAddRule() {
  const from = newFrom.value.trim();
  const to = newTo.value.trim();
  if (!activeVendorId.value) {
    window.$message?.warning($t("settings.safetyReplacements.selectVendor"));
    return;
  }
  if (!from || !to) {
    window.$message?.warning($t("settings.safetyReplacements.fillBoth"));
    return;
  }
  adding.value = true;
  try {
    await axios.post("/setting/safetyReplacements/addRule", {
      vendorId: activeVendorId.value,
      replaceFrom: from,
      replaceTo: to,
    });
    newFrom.value = "";
    newTo.value = "";
    await loadRules();
  } catch (err: any) {
    window.$message?.error(err?.message || $t("settings.safetyReplacements.addFailed"));
  } finally {
    adding.value = false;
  }
}

async function handleImportBuiltin() {
  if (!activeVendorId.value) {
    window.$message?.warning($t("settings.safetyReplacements.selectVendor"));
    return;
  }
  importing.value = true;
  try {
    const existing = new Set(rules.value.map((r) => r.replaceFrom));
    const missing = BUILTIN_RULES.filter(([from]) => !existing.has(from));
    for (const [from, to] of missing) {
      await axios.post("/setting/safetyReplacements/addRule", {
        vendorId: activeVendorId.value,
        replaceFrom: from,
        replaceTo: to,
      });
    }
    await loadRules();
    window.$message?.success($t("settings.safetyReplacements.importDone"));
  } catch (err: any) {
    window.$message?.error(err?.message || $t("settings.safetyReplacements.importFailed"));
  } finally {
    importing.value = false;
  }
}

const fileInputRef = ref<HTMLInputElement | null>(null);
const importingExternal = ref(false);

function triggerFileSelect() {
  fileInputRef.value?.click();
}

// 导出当前供应商的全部替换规则为 JSON 文件（与导入模板格式一致）
function handleExport() {
  if (!rules.value.length) {
    window.$message?.warning($t("settings.safetyReplacements.exportEmpty"));
    return;
  }
  const data = rules.value.map((r) => ({ replaceFrom: r.replaceFrom, replaceTo: r.replaceTo }));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `safety-rules-${activeVendorId.value || "all"}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// 下载导入模板（JSON 对象数组格式，供用户按格式填写后导入）
function handleDownloadTemplate() {
  const template = [
    { replaceFrom: "触发词示例1", replaceTo: "替换词示例1" },
    { replaceFrom: "触发词示例2", replaceTo: "替换词示例2" },
  ];
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "safety-rules-template.json";
  a.click();
  URL.revokeObjectURL(url);
}

// 兼容两种 JSON 格式：对象数组 [{replaceFrom, replaceTo}] 或二元组数组 [["触发词","替换词"]]
function normalizeExternalRules(data: any): [string, string][] {
  if (!Array.isArray(data)) return [];
  const out: [string, string][] = [];
  for (const item of data) {
    if (Array.isArray(item) && item.length >= 2) {
      const [from, to] = item;
      if (String(from ?? "").trim() && String(to ?? "").trim()) {
        out.push([String(from).trim(), String(to).trim()]);
      }
    } else if (item && typeof item === "object") {
      const from = item.replaceFrom ?? item.from;
      const to = item.replaceTo ?? item.to;
      if (String(from ?? "").trim() && String(to ?? "").trim()) {
        out.push([String(from).trim(), String(to).trim()]);
      }
    }
  }
  return out;
}

async function handleImportFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const importedRules = normalizeExternalRules(JSON.parse(await file.text()));
    if (!importedRules.length) {
      window.$message?.warning($t("settings.safetyReplacements.externalEmpty"));
      return;
    }
    if (!activeVendorId.value) {
      window.$message?.warning($t("settings.safetyReplacements.selectVendor"));
      return;
    }
    importingExternal.value = true;
    let added = 0;
    let skipped = 0;
    const existing = new Set(rules.value.map((r) => r.replaceFrom));
    for (const [from, to] of importedRules) {
      if (existing.has(from)) {
        skipped++;
        continue;
      }
      try {
        await axios.post("/setting/safetyReplacements/addRule", {
          vendorId: activeVendorId.value,
          replaceFrom: from,
          replaceTo: to,
        });
        existing.add(from);
        added++;
      } catch {
        skipped++;
      }
    }
    await loadRules();
    window.$message?.success($t("settings.safetyReplacements.importExternalDone", { added, skipped }));
  } catch (err: any) {
    window.$message?.error(err?.message || $t("settings.safetyReplacements.importExternalFailed"));
  } finally {
    importingExternal.value = false;
    input.value = "";
  }
}

async function saveRule(row: SafetyRule, field: "replaceFrom" | "replaceTo") {
  const val = (row[field] || "").trim();
  if (!val) return;
  try {
    await axios.post("/setting/safetyReplacements/updateRule", { id: row.id, [field]: val });
  } catch (err: any) {
    window.$message?.error(err?.message || $t("settings.safetyReplacements.saveFailed"));
    await loadRules();
  }
}

async function toggleRule(row: SafetyRule, val: any) {
  const enabled = Number(val);
  try {
    await axios.post("/setting/safetyReplacements/updateRule", { id: row.id, enabled });
  } catch (err: any) {
    window.$message?.error(err?.message || $t("settings.safetyReplacements.saveFailed"));
    row.enabled = row.enabled === 1 ? 0 : 1;
  }
}

async function handleDeleteRule(row: SafetyRule) {
  try {
    await axios.post("/setting/safetyReplacements/delRule", { id: row.id });
    rules.value = rules.value.filter((r) => r.id !== row.id);
  } catch (err: any) {
    window.$message?.error(err?.message || $t("settings.safetyReplacements.deleteFailed"));
  }
}

const columns = computed(() => [
  {
    colKey: "replaceFrom",
    title: $t("settings.safetyReplacements.fromColumn"),
    width: 280,
    cell: (h: any, { row }: any) =>
      h(TInput, {
        modelValue: row.replaceFrom,
        onChange: (v: any) => (row.replaceFrom = v),
        onBlur: () => saveRule(row, "replaceFrom"),
      }),
  },
  {
    colKey: "replaceTo",
    title: $t("settings.safetyReplacements.toColumn"),
    width: 280,
    cell: (h: any, { row }: any) =>
      h(TInput, {
        modelValue: row.replaceTo,
        onChange: (v: any) => (row.replaceTo = v),
        onBlur: () => saveRule(row, "replaceTo"),
      }),
  },
  {
    colKey: "enabled",
    title: $t("settings.safetyReplacements.enabledColumn"),
    width: 100,
    cell: (h: any, { row }: any) =>
      h(TSwitch, {
        modelValue: row.enabled,
        customValue: [1, 0],
        onChange: (v: any) => toggleRule(row, v),
      }),
  },
  {
    colKey: "op",
    title: $t("settings.safetyReplacements.opColumn"),
    width: 100,
    cell: (h: any, { row }: any) =>
      h(TButton, { theme: "danger", variant: "text", onClick: () => handleDeleteRule(row) }, () => [
        $t("settings.safetyReplacements.delete"),
      ]),
  },
]);

onMounted(() => {
  void getVendorList();
});
</script>

<style lang="scss" scoped>
.safetyReplacements {
  .vendorSelectRow {
    display: flex;
    align-items: center;
    gap: 12px;

    .label {
      font-size: 14px;
      font-weight: 600;
      white-space: nowrap;
    }
  }

  .ruleAddRow {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;

    .arrow {
      color: var(--td-text-color-secondary);
    }
  }
}
</style>
