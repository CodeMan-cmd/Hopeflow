<template>
  <div class="dashboard" v-loading="loading">
    <div class="header">
      <div class="headerActions f ac">
        <t-button theme="primary" variant="outline" @click="openInsightDialog">
          <template #icon><i-magic :size="16" /></template>
          {{ $t("workbench.dashboard.aiInsight") }}
        </t-button>
        <t-button variant="outline" @click="loadStats">
          <template #icon><i-refresh :size="16" /></template>
          {{ $t("workbench.task.refresh") }}
        </t-button>
      </div>
    </div>

    <!-- 规则式异常预警 -->
    <div v-if="alerts.length" class="alertArea">
      <t-alert v-for="(a, idx) in alerts" :key="idx" :theme="a.theme" :message="a.message" />
    </div>

    <!-- 概览卡片 -->
    <div class="overviewGrid">
      <t-card v-for="item in overviewCards" :key="item.key" class="overviewCard" hoverable>
        <div class="overviewValue" :style="{ color: item.color }">{{ item.value }}</div>
        <div class="overviewLabel">{{ item.label }}</div>
      </t-card>
    </div>

    <div class="panelGrid">
      <!-- 模型用量 -->
      <t-card :title="$t('workbench.dashboard.modelTitle')" class="panelCard">
        <t-table :data="stats.modelStats" :columns="modelColumns" row-key="model" size="small" hover stripe>
          <template #empty>
            <t-empty :description="$t('workbench.dashboard.empty')" />
          </template>
          <template #successRate="{ row }">
            <t-tag :theme="row.successRate >= 80 ? 'success' : row.successRate >= 50 ? 'warning' : 'danger'" variant="light" size="small">
              {{ row.successRate }}%
            </t-tag>
          </template>
        </t-table>
      </t-card>

      <!-- 近 14 天趋势 -->
      <t-card :title="$t('workbench.dashboard.trendTitle')" class="panelCard">
        <div class="trendWrap" v-if="stats.trend.length">
          <div class="trendChart">
            <div v-for="day in stats.trend" :key="day.date" class="trendCol" :title="`${day.date}：${day.total} 次`">
              <div class="trendBar" :style="{ height: barHeight(day.total) }"></div>
            </div>
          </div>
          <div class="trendLabels">
            <span v-for="day in stats.trend" :key="day.date" class="trendLabel">{{ day.date }}</span>
          </div>
        </div>
        <t-empty v-else :description="$t('workbench.dashboard.empty')" />
      </t-card>
    </div>

    <!-- 失败归因 -->
    <t-card :title="$t('workbench.dashboard.failTitle')" class="panelCard failCard">
      <div v-if="stats.failReasons.length" class="failList">
        <div v-for="(item, idx) in stats.failReasons" :key="idx" class="failItem">
          <span class="failRank">{{ idx + 1 }}</span>
          <span class="failReason" :title="item.reason">{{ item.reason }}</span>
          <t-tag theme="danger" variant="light" size="small">{{ item.count }}</t-tag>
        </div>
      </div>
      <t-empty v-else :description="$t('workbench.dashboard.empty')" />
    </t-card>

    <!-- AI 洞察报告弹窗 -->
    <t-dialog
      v-model:visible="insightDialogVisible"
      :header="$t('workbench.dashboard.aiInsight')"
      width="720px"
      :confirm-btn="insightConfirmBtn"
      :cancel-btn="$t('common.cancel')"
      :confirm-on-enter="false">
      <!-- 视图：生成报告 + 历史记录（Tab 切换） -->
      <template v-if="insightView !== 'detail'">
        <t-tabs v-model="insightView" :size="'medium'">
          <t-tab-panel value="generate" :label="$t('workbench.dashboard.aiInsight')">
            <t-form label-align="top" :label-width="80">
              <t-form-item :label="$t('workbench.dashboard.aiInsightModel')" required-mark>
                <modelSelect v-model="insightModel" type="text" :placeholder="$t('workbench.dashboard.aiInsightModelPh')" />
              </t-form-item>
            </t-form>
            <t-divider v-if="report" />
            <div v-if="report" class="reportWrap">
              <MdPreview
                :theme="themeSetting.mode === 'auto' ? 'light' : themeSetting.mode"
                :modelValue="report"
                :toolbars="[]"
                preview-only
                preview-theme="github"
                code-theme="atom" />
            </div>
          </t-tab-panel>
          <t-tab-panel value="history" :label="$t('workbench.dashboard.aiInsightHistory')">
            <t-table :data="insightHistory" :columns="historyColumns" row-key="id" size="small" hover stripe :loading="historyLoading">
              <template #empty>
                <t-empty :description="$t('workbench.dashboard.aiInsightHistoryEmpty')" />
              </template>
              <template #createTime="{ row }">
                {{ formatTime(row.createTime) }}
              </template>
              <template #action="{ row }">
                <t-link theme="primary" @click="viewHistory(row)">{{ $t("workbench.dashboard.aiInsightHistoryView") }}</t-link>
                <t-popconfirm :content="$t('workbench.dashboard.aiInsightHistoryDeleteConfirm')" @confirm="deleteHistory(row)">
                  <t-link theme="danger">{{ $t("workbench.dashboard.aiInsightHistoryDelete") }}</t-link>
                </t-popconfirm>
              </template>
            </t-table>
          </t-tab-panel>
        </t-tabs>
      </template>

      <!-- 视图：报告详情 -->
      <template v-else>
        <div v-if="insightDetail" class="detailMeta">
          <t-tag variant="light">{{ insightDetail.model }}</t-tag>
          <span class="detailTime">{{ formatTime(insightDetail.createTime) }}</span>
        </div>
        <div v-if="insightDetail" class="reportWrap">
          <MdPreview
            :theme="themeSetting.mode === 'auto' ? 'light' : themeSetting.mode"
            :modelValue="insightDetail.report"
            :toolbars="[]"
            preview-only
            preview-theme="github"
            code-theme="atom" />
        </div>
      </template>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
import modelSelect from "@/components/modelSelect.vue";
import { MdPreview } from "md-editor-v3";
import settingStore from "@/stores/setting";
import { storeToRefs } from "pinia";

const { themeSetting } = storeToRefs(settingStore());

const loading = ref(false);
const stats = ref<{
  overview: { total: number; running: number; success: number; failed: number; successRate: number };
  modelStats: { model: string; count: number; success: number; failed: number; successRate: number }[];
  trend: { date: string; total: number; success: number; failed: number }[];
  failReasons: { reason: string; count: number }[];
}>({
  overview: { total: 0, running: 0, success: 0, failed: 0, successRate: 0 },
  modelStats: [],
  trend: [],
  failReasons: [],
});

const overviewCards = computed(() => {
  const o = stats.value.overview;
  return [
    { key: "total", label: $t("workbench.dashboard.overviewTotal"), value: o.total, color: "var(--td-text-color-primary)" },
    { key: "running", label: $t("workbench.dashboard.overviewRunning"), value: o.running, color: "var(--td-brand-color)" },
    { key: "success", label: $t("workbench.dashboard.overviewSuccess"), value: o.success, color: "var(--td-success-color)" },
    { key: "failed", label: $t("workbench.dashboard.overviewFailed"), value: o.failed, color: "var(--td-error-color)" },
    { key: "rate", label: $t("workbench.dashboard.overviewRate"), value: `${o.successRate}%`, color: "var(--td-warning-color)" },
  ];
});

const modelColumns = [
  { colKey: "model", title: $t("workbench.dashboard.colModel"), ellipsis: true },
  { colKey: "count", title: $t("workbench.dashboard.colCount"), width: 90 },
  { colKey: "success", title: $t("workbench.dashboard.colSuccess"), width: 90 },
  { colKey: "failed", title: $t("workbench.dashboard.colFailed"), width: 90 },
  { colKey: "successRate", title: $t("workbench.dashboard.colRate"), width: 110, cell: "successRate" },
];

function barHeight(total: number) {
  const max = Math.max(...stats.value.trend.map((d) => d.total), 1);
  const h = Math.round((total / max) * 120);
  return `${Math.max(h, 4)}px`;
}

// ────────────── 规则式异常预警（本地计算，零 AI 成本） ──────────────
const alerts = ref<{ theme: "warning" | "error"; message: string }[]>([]);

function checkAlerts() {
  const list: { theme: "warning" | "error"; message: string }[] = [];
  const o = stats.value.overview;
  if (o.total > 0 && o.successRate < 60) {
    list.push({ theme: "warning", message: $t("workbench.dashboard.alertLowRate") });
  }
  const today = todayKey();
  const last7 = stats.value.trend.slice(-7).filter((d) => d.date !== today);
  const avg = last7.length ? last7.reduce((s, d) => s + d.failed, 0) / last7.length : 0;
  const todayFailed = stats.value.trend.find((d) => d.date === today)?.failed ?? 0;
  if (avg > 0 && todayFailed >= avg * 2) {
    list.push({ theme: "error", message: $t("workbench.dashboard.alertFailSurge") });
  }
  alerts.value = list;
}

function todayKey() {
  const d = new Date();
  return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, "0")}`;
}

async function loadStats() {
  loading.value = true;
  try {
    const { data } = await axios.get("/dashboard/getStats");
    stats.value = data ?? stats.value;
    checkAlerts();
  } catch (e) {
    console.error(e);
    window.$message.error($t("workbench.dashboard.fetchFailed"));
  } finally {
    loading.value = false;
  }
}

// ────────────── AI 洞察报告 ──────────────
type InsightView = "generate" | "history" | "detail";

const insightDialogVisible = ref(false);
const insightLoading = ref(false);
const insightModel = ref("");
const report = ref("");
const insightView = ref<InsightView>("generate");
const insightHistory = ref<{ id: number; model: string; createTime: number }[]>([]);
const historyLoading = ref(false);
const insightDetail = ref<{ id: number; model: string; report: string; createTime: number } | null>(null);

// 弹窗底部按钮随视图切换：生成 / 历史 → 新建 / 详情 → 返回列表
const insightConfirmBtn = computed(() => {
  if (insightView.value === "generate") {
    return { content: $t("workbench.dashboard.aiInsightStart"), loading: insightLoading.value, onClick: () => { onAiInsight(); return false; } };
  }
  if (insightView.value === "history") {
    return { content: $t("workbench.dashboard.aiInsightNew"), onClick: () => { insightView.value = "generate"; return false; } };
  }
  return { content: $t("workbench.dashboard.aiInsightBack"), onClick: () => { insightView.value = "history"; return false; } };
});

const historyColumns = [
  { colKey: "model", title: $t("workbench.dashboard.aiInsightHistoryModel"), ellipsis: true },
  { colKey: "createTime", title: $t("workbench.dashboard.aiInsightHistoryTime"), width: 170, cell: "createTime" },
  { colKey: "action", title: $t("workbench.dashboard.aiInsightHistoryAction"), width: 130, cell: "action" },
];

function formatTime(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function openInsightDialog() {
  insightModel.value = "";
  report.value = "";
  insightView.value = "generate";
  insightDialogVisible.value = true;
}

async function onAiInsight() {
  if (!insightModel.value) {
    window.$message.warning($t("workbench.dashboard.aiInsightModelPh"));
    return;
  }
  insightLoading.value = true;
  try {
    const { data } = await axios.post("/dashboard/aiInsight", { model: insightModel.value });
    report.value = data?.report ?? "";
    window.$message.success($t("workbench.dashboard.aiInsightHistorySaved"));
  } catch (e) {
    console.error(e);
    window.$message.error($t("workbench.dashboard.aiInsightFailed"));
  } finally {
    insightLoading.value = false;
  }
}

async function loadHistory() {
  historyLoading.value = true;
  try {
    const { data } = await axios.get("/dashboard/aiInsight/history");
    insightHistory.value = data ?? [];
  } catch (e) {
    console.error(e);
    window.$message.error($t("workbench.dashboard.aiInsightHistoryLoadFailed"));
  } finally {
    historyLoading.value = false;
  }
}

async function viewHistory(row: { id: number }) {
  try {
    const { data } = await axios.get(`/dashboard/aiInsight/history/${row.id}`);
    insightDetail.value = data;
    insightView.value = "detail";
  } catch (e) {
    console.error(e);
    window.$message.error($t("workbench.dashboard.aiInsightDetailFailed"));
  }
}

async function deleteHistory(row: { id: number }) {
  try {
    await axios.delete(`/dashboard/aiInsight/history/${row.id}`);
    window.$message.success($t("workbench.dashboard.aiInsightHistoryDeleted"));
    loadHistory();
  } catch (e) {
    console.error(e);
    window.$message.error($t("workbench.dashboard.aiInsightHistoryDeleteFailed"));
  }
}

// 切到历史视图时懒加载列表
watch(insightView, (v) => {
  if (v === "history") loadHistory();
});

onMounted(loadStats);
</script>

<style lang="scss" scoped>
.dashboard {
  .header {
    margin-bottom: 24px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    .headerActions {
      gap: var(--app-space-2);
    }
  }

  .alertArea {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: var(--app-space-3);
  }

  .overviewGrid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: var(--app-space-3);
    margin-bottom: var(--app-space-4);
    .overviewCard {
      .overviewValue {
        font-size: 26px;
        font-weight: 700;
        line-height: 1.2;
      }
      .overviewLabel {
        margin-top: 4px;
        font-size: 14px;
        color: var(--td-text-color-secondary);
      }
    }
  }

  .panelGrid {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    gap: var(--app-space-3);
    margin-bottom: var(--app-space-3);
  }

  .trendWrap {
    .trendChart {
      display: flex;
      align-items: flex-end;
      gap: 6px;
      height: 130px;
      padding: 8px 4px 0;
      border-bottom: 1px solid var(--td-component-border);
      .trendCol {
        flex: 1;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        .trendBar {
          width: 60%;
          max-width: 24px;
          min-height: 4px;
          border-radius: 3px 3px 0 0;
          background: var(--td-brand-color);
          opacity: 0.85;
        }
      }
    }
    .trendLabels {
      display: flex;
      gap: 6px;
      margin-top: 6px;
      .trendLabel {
        flex: 1;
        text-align: center;
        font-size: 12px;
        color: var(--td-text-color-placeholder);
        overflow: hidden;
        white-space: nowrap;
      }
    }
  }

  .failList {
    .failItem {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 4px;
      border-bottom: 1px dashed var(--td-component-border);
      &:last-child {
        border-bottom: none;
      }
      .failRank {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--td-error-color-light);
        color: var(--td-error-color);
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .failReason {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 14px;
      }
    }
  }

  .reportWrap {
    max-height: 420px;
    overflow: auto;
    border: 1px solid var(--td-component-border);
    border-radius: 6px;
    padding: 8px 12px;
  }

  .detailMeta {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    .detailTime {
      font-size: 13px;
      color: var(--td-text-color-placeholder);
    }
  }
}
</style>
