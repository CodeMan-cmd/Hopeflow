<template>
  <div class="taskTable">
    <div class="search f">
      <t-select
        v-if="!projectId"
        :label="$t('workbench.task.project')"
        v-model="projectIdFilter"
        :options="projectData"
        @change="onFilterChange" />
      <t-select :label="$t('workbench.task.categoryLabel')" v-model="taskClass" :options="categoryOptions" @change="onFilterChange" />
      <t-select :label="$t('workbench.task.stateLabel')" v-model="taskState" :options="stateOptions" @change="onFilterChange" />
    </div>
    <t-table :data="taskList" :columns="columns" row-key="id" :loading="pagination.loading" hover stripe>
      <template #empty>
        <AppEmpty :description="$t('workbench.task.emptyDesc')" compact>
          <template #action>
            <t-button v-if="!projectId" theme="primary" @click="router.push('/project')">
              <template #icon>
                <i-folder-close :size="16" />
              </template>
              {{ $t("workbench.menu.myProject") }}
            </t-button>
          </template>
        </AppEmpty>
      </template>
      <template #state="{ row }">
        <t-tooltip v-if="row.state === '生成失败'" :content="row.reason || $t('workbench.task.noFailReason')" placement="top">
          <span class="stateText stateFail">{{ row.state }}</span>
        </t-tooltip>
        <span v-else-if="row.state === '已停止'" class="stateText stateStopped">{{ row.state }}</span>
        <span v-else class="stateText" :class="row.state === '进行中' ? 'stateRunning' : 'stateSuccess'">
          {{ row.state }}
        </span>
      </template>
      <template #startTime="{ row }">
        <span>{{ dayjs(row.startTime).format("YYYY-MM-DD HH:mm:ss") }}</span>
      </template>
      <template #operation="{ row }">
        <t-space size="small">
          <t-button size="small" variant="text" theme="primary" @click="openParams(row)">
            {{ $t("workbench.task.viewParams") }}
          </t-button>
          <t-button v-if="row.state === '进行中'" size="small" variant="text" theme="danger" @click="stopTask(row)">
            {{ $t("workbench.task.stop") }}
          </t-button>
        </t-space>
      </template>
    </t-table>
    <t-dialog v-model:visible="paramsVisible" :header="$t('workbench.task.paramsTitle')" :footer="false" width="640px" destroy-on-close>
      <div class="paramsSection" v-if="paramsResponse">
        <div class="paramsLabel">{{ $t("workbench.task.paramsResponse") }}</div>
        <pre class="paramsContent">{{ paramsResponse }}</pre>
      </div>
      <div class="paramsSection" v-if="paramsRequest">
        <div class="paramsLabel">{{ $t("workbench.task.paramsRequest") }}</div>
        <pre class="paramsContent">{{ paramsRequest }}</pre>
      </div>
      <p v-if="!paramsResponse && !paramsRequest" class="paramsEmptyText">{{ $t("workbench.task.paramsEmpty") }}</p>
    </t-dialog>
    <t-pagination
      class="paginationWrap"
      v-model:current="pagination.page"
      v-model:pageSize="pagination.limit"
      show-sizer
      :total="pagination.total"
      @page-size-change="() => getTaskList()"
      @current-change="() => getTaskList()" />
  </div>
</template>

<script setup lang="ts">
import dayjs from "dayjs";
import axios from "@/utils/axios";
import projectStore from "@/stores/project";
import settingStore from "@/stores/setting";
import AppEmpty from "@/components/feedback/AppEmpty.vue";
import { DialogPlugin } from "tdesign-vue-next";

// 共享任务表格：/task 全局页与项目卡片任务抽屉复用
// projectId 传入则锁定该项目（抽屉模式）；不传则全局模式（可下拉选项目/看全部）
const props = withDefaults(
  defineProps<{
    projectId?: number;
    active?: boolean;
  }>(),
  { active: true },
);

const { project } = storeToRefs(projectStore());
const { otherSetting } = storeToRefs(settingStore());
const router = useRouter();

interface TaskItem {
  id: number;
  taskClass: string;
  relatedObjects: string;
  model: string;
  projectName: string;
  episode: string;
  state: string;
  startTime: number;
  describe?: string;
  reason?: string;
  result?: string;
}

const columns = [
  { colKey: "taskClass", title: $t("workbench.task.col.taskClass"), width: 120, ellipsis: true },
  { colKey: "relatedObjects", title: $t("workbench.task.col.relatedObjects"), width: 120, ellipsis: true },
  { colKey: "model", title: $t("workbench.task.col.model"), width: 280, ellipsis: true },
  { colKey: "describe", title: $t("workbench.task.col.describe"), ellipsis: true },
  { colKey: "reason", title: $t("workbench.task.col.reason"), ellipsis: true },
  { colKey: "state", title: $t("workbench.task.col.state"), width: 100, cell: "state" },
  { colKey: "startTime", title: $t("workbench.task.col.startTime"), width: 200, cell: "startTime" },
  { colKey: "operation", title: $t("workbench.task.col.operation"), width: 160, cell: "operation" },
];

const stateOptions = [
  { label: $t("workbench.task.stateAll"), value: "" },
  { label: $t("workbench.task.stateRunning"), value: "进行中" },
  { label: $t("workbench.task.stateCompleted"), value: "已完成" },
  { label: $t("workbench.task.stateFailed"), value: "生成失败" },
  { label: $t("workbench.task.stateStopped"), value: "已停止" },
];

const pagination = ref({ page: 1, limit: 10, total: 0, loading: false });
const categoryOptions = ref<{ label: string; value: string }[]>([]);
const projectData = ref<{ label: string; value: string }[]>([]);
const taskClass = ref("");
const taskState = ref("");
const projectIdFilter = ref("");
const taskList = ref<TaskItem[]>([]);

// ── 查看任务参数 ──
const paramsVisible = ref(false);
const paramsRequest = ref("");
const paramsResponse = ref("");
function formatParam(text: string): string {
  if (!text) return "";
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    // 非 JSON 参数保持原文展示
    return text;
  }
}
function openParams(row: TaskItem) {
  paramsRequest.value = formatParam(row.relatedObjects ?? "");
  paramsResponse.value = formatParam(row.result ?? "");
  paramsVisible.value = true;
}

// ── 停止进行中的任务 ──
async function stopTask(row: TaskItem) {
  const dlg = DialogPlugin.confirm({
    header: $t("workbench.task.stop"),
    body: $t("workbench.task.stopConfirm"),
    confirmBtn: $t("workbench.task.stop"),
    cancelBtn: $t("settings.memory.msg.cancel"),
    onConfirm: async () => {
      dlg.destroy();
      try {
        await axios.post("/task/stopTask", { taskId: row.id });
        window.$message.success($t("workbench.task.stopped"));
        getTaskList();
      } catch (e: any) {
        window.$message.error(e?.message ?? $t("workbench.task.stopFailed"));
      }
    },
    onCancel: () => dlg.destroy(),
  });
}

onMounted(() => {
  getTaskList();
  getCategories();
  if (!props.projectId) getProject();
  document.addEventListener("visibilitychange", onVisibilityChange);
});

onUnmounted(() => {
  stopPolling();
  document.removeEventListener("visibilitychange", onVisibilityChange);
});

// 抽屉切换不同项目时重置筛选并刷新
watch(
  () => props.projectId,
  () => {
    taskClass.value = "";
    taskState.value = "";
    pagination.value.page = 1;
    getTaskList();
  },
);

// 轮询门控：组件不可见（抽屉关闭）时停止轮询
watch(
  () => props.active,
  (v) => {
    if (v) {
      getTaskList(true);
    } else {
      stopPolling();
    }
  },
);

function onFilterChange() {
  pagination.value.page = 1;
  getTaskList();
}

// ── 智能自动轮询：仅当列表存在「进行中」任务且可见、配置开启时，按配置间隔静默刷新 ──
let pollTimer: ReturnType<typeof setInterval> | null = null;

function hasRunningTask() {
  return taskList.value.some((i) => i.state === "进行中");
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// 每次列表拉取后调用：可见 + 配置开启 + 有进行中任务才（重）启动轮询，否则停止
function schedulePolling() {
  stopPolling();
  if (!props.active || otherSetting.value.taskAutoRefresh === false || !hasRunningTask() || document.hidden) return;
  const intervalMs = (Number(otherSetting.value.taskRefreshInterval) || 5) * 1000;
  pollTimer = setInterval(() => getTaskList(true), intervalMs);
}

// 页面切后台暂停轮询；切回前台立即刷新一次（内部会按需重启轮询）
function onVisibilityChange() {
  if (!props.active) return;
  if (document.hidden) {
    stopPolling();
  } else {
    getTaskList(true);
  }
}

async function getCategories() {
  const { data } = await axios.post("/task/getTaskCategories").catch(() => ({ data: [] }));
  categoryOptions.value = [
    { label: $t("workbench.task.stateAll"), value: "" },
    ...data.map((i: any) => ({ label: i.taskClass, value: i.taskClass })),
  ];
}

async function getProject() {
  const { data } = await axios.post("/task/getProject").catch(() => ({ data: [] }));
  projectData.value = [{ label: $t("workbench.task.stateAll"), value: "" }, ...data.map((i: any) => ({ label: i.name, value: i.id }))];
}

// silentRefresh=true 用于自动轮询/前台切回：不置表格 loading，避免轮询时闪烁
async function getTaskList(silentRefresh = false) {
  if (!silentRefresh) pagination.value.loading = true;
  try {
    const { data } = await axios.post("/task/getTaskApi", {
      page: pagination.value.page,
      limit: pagination.value.limit,
      taskClass: taskClass.value,
      state: taskState.value,
      projectId: props.projectId ?? (projectIdFilter.value || project.value?.id),
    }, { silent: true });
    taskList.value = data.data;
    pagination.value.total = data.total;
  } catch {
    if (!silentRefresh) window.$message.error($t("workbench.task.fetchFailed"));
  } finally {
    pagination.value.loading = false;
    schedulePolling();
  }
}
</script>

<style lang="scss" scoped>
.taskTable {
  .search {
    gap: var(--app-space-3);
    margin-bottom: var(--app-space-3);
  }
  .stateText {
    font-weight: bold;
  }
  .stateFail {
    color: var(--td-error-color);
    cursor: pointer;
  }
  .stateRunning {
    color: var(--td-brand-color);
  }
  .stateStopped {
    color: var(--td-text-color-secondary);
  }
  .stateSuccess {
    color: var(--td-success-color);
  }
  .paramsContent {
    margin: 0;
    max-height: 40vh;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-all;
    font-size: 12px;
    line-height: 1.6;
    background: var(--td-bg-color-secondarycontainer);
    border-radius: 6px;
    padding: 12px;
    color: var(--td-text-color-primary);
  }
  .paramsSection {
    margin-bottom: 12px;
  }
  .paramsLabel {
    font-size: 13px;
    font-weight: 600;
    color: var(--td-text-color-primary);
    margin-bottom: 6px;
  }
  .paramsEmptyText {
    color: var(--td-text-color-placeholder);
    font-size: 13px;
    text-align: center;
    padding: 24px 0;
  }
  .paginationWrap {
    margin-top: 10px;
  }
}
</style>
