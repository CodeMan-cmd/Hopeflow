<template>
  <div class="project">
    <PageToolbar :title="$t('workbench.project.title')" :subtitle="$t('workbench.project.subtitle')">
      <t-button
        variant="outline"
        @click="
          editProjectData = null;
          aiDialogShow = true;
        ">
        <template #icon><i-add :size="16" /></template>
        {{ $t("workbench.project.aiCreateProject") }}
      </t-button>
      <t-button
        @click="
          editProjectData = null;
          aiPrefillData = null;
          aiGeneratedContent = null;
          dialogShow = true;
        ">
        <template #icon><i-plus :size="16" /></template>
        {{ $t("workbench.project.newProject") }}
      </t-button>
    </PageToolbar>
    <div class="filterBar f ac">
      <t-input v-model="searchText" :placeholder="$t('workbench.project.searchPlaceholder')" clearable style="width: 240px" />
      <t-select v-model="sortType" :options="sortOptions" style="width: 170px" />
    </div>
    <AppSkeleton v-if="listLoading" variant="card" :count="6" :columns="3" />
    <AppEmpty v-else-if="filteredProjects.length === 0" :title="searchText ? undefined : $t('workbench.project.emptyTitle')" :description="searchText ? $t('workbench.project.searchEmpty') : $t('workbench.project.emptyDesc')">
      <template #action>
        <t-space>
          <t-button variant="outline" @click="aiDialogShow = true">
            <template #icon><i-add :size="16" /></template>
            {{ $t("workbench.project.aiCreateProject") }}
          </t-button>
          <t-button @click="dialogShow = true">
            <template #icon><i-plus :size="16" /></template>
            {{ $t("workbench.project.newProject") }}
          </t-button>
        </t-space>
      </template>
    </AppEmpty>
    <div class="list" v-else>
      <t-card hoverShadow class="card" v-for="project in filteredProjects" :key="project.id" @click="selectProject(project)">
        <div class="cover" :style="{ background: coverGradient(project.id) }">
          <div class="coverTop jb ac">
            <span class="coverTitle">{{ project.name }}</span>
            <t-tag shape="round" size="small" class="coverTypeTag">
              {{ project.projectType == "novel" ? $t(`workbench.project.type.novel`) : $t(`workbench.project.type.script`) }}
            </t-tag>
          </div>
          <div class="coverBottom jb ac">
            <t-tag v-if="project.artStyle" shape="round" variant="light-outline" size="small" class="artStyleTag">{{ project.artStyle }}</t-tag>
            <div class="openBtn c" :title="$t('workbench.project.msg.enterProject')" @click.stop="openProject(project.id)">
              <i-arrow-right :size="16" />
            </div>
          </div>
        </div>
        <div class="time">{{ dayjs(project?.createTime).format("YYYY-MM-DD") }}</div>
        <div class="intro">
          {{ project.intro }}
        </div>
        <div class="footer f ac jb">
          <div class="models f ac" v-if="project.imageModel || project.videoModel">
            <span class="model" :title="project.imageModel" v-if="project.imageModel">{{ project.imageModel }}</span>
            <span class="model" :title="project.videoModel" v-if="project.videoModel">{{ project.videoModel }}</span>
          </div>
          <div class="ops f ac">
            <div class="opBtn" :title="$t('workbench.menu.taskCenter')" @click.stop="openTaskDrawer(project)">
              <i-view-list :size="16" />
            </div>
            <div class="opBtn" :title="$t('workbench.project.diagnose.button')" @click.stop="openDiagnose(project)">
              <i-search :size="16" />
            </div>
            <div class="opBtn" title="编辑" @click.stop="openEdit(project)">
              <i-edit :size="16" />
            </div>
            <div class="opBtn" @click.stop="delProjcer(project.id)">
              <i-delete :size="16" />
            </div>
          </div>
        </div>
      </t-card>
    </div>
  </div>
  <projectDialog v-model="dialogShow" :projectData="editProjectData" :prefillData="aiPrefillData" @add="addProjectFn" @edit="editProjectFn" />
  <aiProjectDialog v-model="aiDialogShow" @complete="onAiComplete" />

  <!-- 项目任务抽屉：查看该项目的生成任务 -->
  <t-drawer
    v-model:visible="taskDrawerVisible"
    :header="taskDrawerProject ? `${taskDrawerProject.name} · ${$t('workbench.task.title')}` : ''"
    size="720px"
    :footer="false"
    destroy-on-close>
    <taskTable v-if="taskDrawerProject" :project-id="Number(taskDrawerProject.id)" :active="taskDrawerVisible" />
  </t-drawer>

  <!-- 项目诊断：提前发现会导致批量生成提示词/资产失败的配置问题 -->
  <t-dialog
    placement="center"
    v-model:visible="diagnoseVisible"
    :header="$t('workbench.project.diagnose.title')"
    width="560px"
    :footer="false">
    <t-loading v-if="diagnoseLoading" style="min-height: 160px" />
    <div class="diagnosePanel" v-else-if="diagnoseItems.length">
      <div class="diagnoseSummary" :class="diagnoseSummary.error ? 'hasError' : diagnoseSummary.warn ? 'hasWarn' : 'allOk'">
        {{ $t("workbench.project.diagnose.summary", { total: diagnoseSummary.total, ok: diagnoseSummary.ok, warn: diagnoseSummary.warn, error: diagnoseSummary.error }) }}
      </div>
      <div class="diagnoseItem" v-for="item in diagnoseItems" :key="item.key">
        <t-tag
          size="small"
          :theme="item.status === 'ok' ? 'success' : item.status === 'warn' ? 'warning' : 'danger'"
          variant="light">
          {{ $t(`workbench.project.diagnose.status.${item.status}`) }}
        </t-tag>
        <div class="diagnoseBody">
          <div class="diagnoseTitle">{{ $t(`workbench.project.diagnose.${item.key}.title`) }}</div>
          <div class="diagnoseMsg">{{ $t(`workbench.project.diagnose.${item.key}.${item.status}`, { detail: item.detail ?? "" }) }}</div>
        </div>
      </div>
    </div>
    <t-empty v-else :description="$t('workbench.project.diagnose.empty')" />
  </t-dialog>
</template>

<script setup lang="ts">
import projectDialog from "./components/projectDialog.vue";
import aiProjectDialog from "./components/aiProjectDialog.vue";
import taskTable from "@/views/task/components/taskTable.vue";
import AppEmpty from "@/components/feedback/AppEmpty.vue";
import AppSkeleton from "@/components/feedback/AppSkeleton.vue";
import pageToolbar from "@/components/pageToolbar.vue";
import dayjs from "dayjs";
import axios from "@/utils/axios";
import projectStore from "@/stores/project";
import imageListCacheStore from "@/stores/imageListCache";

const { clearProjectCache } = imageListCacheStore();
const { allProject, project } = storeToRefs(projectStore());

const dialogShow = ref(false);
const aiDialogShow = ref(false);
const listLoading = ref(true);
const searchText = ref("");
const sortType = ref("time-desc");
// 项目任务抽屉状态
const taskDrawerVisible = ref(false);
const taskDrawerProject = ref<{ id: string; name: string } | null>(null);

function openTaskDrawer(item: { id: string | number; name: string }) {
  taskDrawerProject.value = { id: String(item.id), name: item.name };
  taskDrawerVisible.value = true;
}
const sortOptions = [
  { label: $t("workbench.project.sortTimeDesc"), value: "time-desc" },
  { label: $t("workbench.project.sortTimeAsc"), value: "time-asc" },
  { label: $t("workbench.project.sortNameAsc"), value: "name-asc" },
];

// 封面渐变占位：按项目 id 确定性取色（专业深色调 4 色，统一叠加暗色层保证白字可读）
const coverGradients = [
  "linear-gradient(135deg, #3d4d6e 0%, #232c42 100%)", // 藏蓝
  "linear-gradient(135deg, #27505f 0%, #152f3b 100%)", // 深青
  "linear-gradient(135deg, #4a3e5c 0%, #2a2236 100%)", // 暗紫（低饱和）
  "linear-gradient(135deg, #5a3b3b 0%, #321e1e 100%)", // 暗红褐
];
function coverGradient(id: string | number | undefined) {
  let hash = 0;
  for (const ch of String(id ?? "")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const base = coverGradients[hash % coverGradients.length];
  return `linear-gradient(rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.12)), ${base}`;
}

// 本地搜索 + 排序（数据来自 /project/getProject 全量，前端过滤）
const filteredProjects = computed(() => {
  const kw = searchText.value.trim().toLowerCase();
  const list = allProject.value.filter((p) => !kw || String(p.name || "").toLowerCase().includes(kw));
  return [...list].sort((a, b) => {
    switch (sortType.value) {
      case "name-asc":
        return String(a.name || "").localeCompare(String(b.name || ""));
      case "time-asc":
        return (a.createTime || 0) - (b.createTime || 0);
      default:
        return (b.createTime || 0) - (a.createTime || 0);
    }
  });
});

const aiPrefillData = ref<Partial<{
  projectType: string;
  name: string;
  type: string;
  intro: string;
  artStyle: string;
  videoRatio: string;
  imageModel: string;
  imageQuality: "1K" | "2K" | "4K" | "";
  videoModel: string;
  mode: string;
  directorManual: string;
  needAdaptation: string;
  /** 画风解析不到时后端回传的内置手册候选，供配置页一键选择 */
  artStyleCandidates: { value: string; label: string }[];
}> | null>(null);
const aiGeneratedContent = ref<{ novelContent: { name: string; content: string }[]; scriptContent: { name: string; content: string }[] } | null>(null);
const editProjectData = ref<{
  id: string;
  name: string;
  intro: string;
  type: string;
  artStyle: string | null;
  videoRatio: string | null;
  imageModel: string;
  videoModel: string;
  projectType: string;
  imageQuality: "1K" | "2K" | "4K" | "";
  mode: string;
  directorManual: string;
  needAdaptation: string;
} | null>(null);

async function getAllProject() {
  listLoading.value = true;
  try {
    const { data } = await axios.post("/project/getProject");
    allProject.value = data;
  } finally {
    listLoading.value = false;
  }
}

onMounted(() => {
  getAllProject();
});

const router = useRouter();

// 仅切换当前项目（供知识库/资产/任务等模块使用），不自动跳转
function selectProject(item: (typeof allProject.value)[number]) {
  project.value = item;
  if (!item.imageModel || !item.videoModel) {
    window.$message.warning($t("workbench.project.msg.modelProviderDisabled"));
  } else {
    window.$message.success($t("workbench.project.msg.switched", { name: item.name }));
  }
}

async function openProject(projectId: string | undefined) {
  const item = allProject.value.find((p) => p.id === projectId);

  if (!item) return window.$message.error($t("workbench.project.msg.notFound"));

  if (!item.imageModel || !item.videoModel) {
    window.$message.warning($t("workbench.project.msg.modelProviderDisabled"));
    return openEdit(item);
  }

  try {
    if (item.imageModel) {
      await axios.post("/modelSelect/getModelDetail", {
        modelId: item.imageModel,
      });
    }
    if (item.videoModel) {
      await axios.post("/modelSelect/getModelDetail", {
        modelId: item.videoModel,
      });
    }
  } catch {
    window.$message.warning($t("workbench.project.msg.modelProviderDisabled"));
    return openEdit(item);
  }

  project.value = item;
  if (item.projectType === "novel") router.push(`/novel`);
  else if (item.projectType === "script") router.push(`/script`);
}

function openEdit(item: {
  id: string;
  name: string;
  intro: string;
  type: string;
  artStyle: string | null;
  directorManual: string;
  videoRatio: string | null;
  imageModel: string;
  videoModel: string;
  imageQuality: "1K" | "2K" | "4K" | "";
  projectType: string;
  mode: string;
  needAdaptation: string;
}) {
  editProjectData.value = {
    ...item,
  };
  aiPrefillData.value = null;
  aiGeneratedContent.value = null;
  dialogShow.value = true;
}

function editProjectFn(data: {
  id: string;
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
}) {
  axios
    .post("/project/editProject", data, { silent: true })
    .then(() => {
      window.$message.success($t("workbench.project.msg.editSuccess"));
      getAllProject();
    })
    .catch((e) => {
      window.$message.error(e.message ?? $t("workbench.project.msg.editFailed"));
    });
}

// ==================== 项目诊断 ====================
interface DiagnoseItem {
  key: string;
  status: "ok" | "warn" | "error";
  detail?: string;
}
interface DiagnoseSummary {
  total: number;
  ok: number;
  warn: number;
  error: number;
}
const diagnoseVisible = ref(false);
const diagnoseLoading = ref(false);
const diagnoseItems = ref<DiagnoseItem[]>([]);
const diagnoseSummary = ref<DiagnoseSummary>({ total: 0, ok: 0, warn: 0, error: 0 });

async function openDiagnose(item: { id: string | number; name: string }) {
  diagnoseVisible.value = true;
  diagnoseLoading.value = true;
  diagnoseItems.value = [];
  try {
    const { data } = await axios.post("/project/diagnose", { projectId: Number(item.id) });
    diagnoseItems.value = data?.items ?? [];
    diagnoseSummary.value = data?.summary ?? { total: 0, ok: 0, warn: 0, error: 0 };
  } catch (e: any) {
    window.$message.error(e?.message ?? $t("workbench.project.msg.diagnoseFailed"));
  } finally {
    diagnoseLoading.value = false;
  }
}

function addProjectFn(data: {
  projectType: string;
  name: string;
  intro: string;
  type: string;
  artStyle: string;
  directorManual: string;
  videoRatio: string;
  imageModel: string;
  videoModel: string;
  imageQuality: string;
  mode: string;
  needAdaptation: string;
}) {
  axios
    .post("/project/addProject", data, { silent: true })
    .then(({ data: res }) => {
      const projectId = res.id;
      // 保存 AI 生成的内容
      const generated = aiGeneratedContent.value;
      if (generated?.novelContent?.length) {
        axios.post("/novel/addNovel", {
          projectId,
          data: generated.novelContent.map((c, i) => ({
            index: i,
            reel: "",
            chapter: c.name,
            chapterData: c.content,
          })),
        });
      }
      if (generated?.scriptContent?.length) {
        axios.post("/script/batchAddScript", {
          projectId,
          data: generated.scriptContent.map((s) => ({
            scriptName: s.name,
            scriptData: s.content,
          })),
        });
      }
      aiGeneratedContent.value = null;
      aiPrefillData.value = null;
      window.$message.success($t("workbench.project.msg.addSuccess"));
      getAllProject();
    })
    .catch((e) => {
      window.$message.error(e.message ?? $t("workbench.project.msg.addFailed"));
    });
}

async function onAiComplete(data: { projectInfo: { projectType: string; name: string; type: string; intro: string; artStyle: string; videoRatio: string }; novelContent: { name: string; content: string }[]; scriptContent: { name: string; content: string }[] }) {
  aiDialogShow.value = false;
  aiPrefillData.value = data.projectInfo;
  aiGeneratedContent.value = { novelContent: data.novelContent, scriptContent: data.scriptContent };
  editProjectData.value = null;
  // 全自动：调后端推荐配置（模型/画质/模式/画风路径/导演手册），补齐后直达确认页
  try {
    const { data: config } = await axios.post("/project/recommendConfig", { artStyle: data.projectInfo.artStyle });
    aiPrefillData.value = {
      ...data.projectInfo,
      imageModel: config.imageModel,
      imageQuality: config.imageQuality,
      videoModel: config.videoModel,
      mode: config.mode,
      directorManual: config.directorManual,
      // 画风解析不到时把候选一并带过去，配置页会强制用户重选，而不是静默落库
      artStyleCandidates: config.artStyleCandidates ?? [],
    };
    if (config.artStyle) aiPrefillData.value.artStyle = config.artStyle;
  } catch (e) {
    // 推荐失败不阻塞，用户仍可在表单中手动选择
    console.error("推荐配置失败", e);
  }
  dialogShow.value = true;
}

function delProjcer(projectId: string | undefined) {
  const dialog = DialogPlugin.confirm({
    header: $t("workbench.project.msg.deleteHeader"),
    body: $t("workbench.project.msg.deleteBody"),
    confirmBtn: $t("workbench.project.msg.deleteConfirm"),
    cancelBtn: $t("workbench.project.msg.deleteCancel"),
    onConfirm: () => {
      axios
        .post("/project/delProject", { id: projectId }, { silent: true })
        .then(() => {
          clearProjectCache(projectId!);
          // 删除的是当前选中项目时，同步清空项目上下文
          if (project.value?.id === projectId) project.value = null;
          window.$message.success($t("workbench.project.msg.deleteSuccess"));
          getAllProject();
        })
        .catch((e) => {
          window.$message.error(e.message ?? $t("workbench.project.msg.deleteFailed"));
        })
        .finally(() => {
          dialog.destroy();
        });
    },
  });
}
</script>

<style lang="scss" scoped>
.project {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);

  .filterBar {
    gap: var(--app-space-3);
  }
  .list {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--app-space-card-gap);
    .card {
      width: 100%;
      height: 100%;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      border: 1px solid var(--td-component-stroke);
      border-radius: var(--app-radius-card);
      transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
      &:hover {
        border-color: var(--td-brand-color);
        box-shadow: var(--td-shadow-1);
      }
      .cover {
        position: relative;
        height: 150px;
        border-radius: var(--td-radius-medium);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 16px;
        color: #fff;
        overflow: hidden;
        margin-bottom: 12px;
        // 径向高光装饰：增强质感而非廉价渐变
        &::after {
          content: "";
          position: absolute;
          top: 0;
          right: 0;
          width: 60%;
          height: 100%;
          background: radial-gradient(circle at 85% 15%, rgba(255, 255, 255, 0.14), transparent 45%);
          pointer-events: none;
        }
        .coverTop {
          min-width: 0;
          gap: 8px;
          z-index: 1;
          .coverTitle {
            font-size: 18px;
            font-weight: 700;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            min-width: 0;
          }
        }
        .coverBottom {
          gap: 8px;
          z-index: 1;
          .artStyleTag {
            max-width: 60%;
            overflow: hidden;
            text-overflow: ellipsis;
            background-color: rgba(255, 255, 255, 0.12);
            color: rgba(255, 255, 255, 0.9);
            border-color: transparent;
          }
          .openBtn {
            flex-shrink: 0;
            width: 30px;
            height: 30px;
            border-radius: var(--td-radius-round);
            background: rgba(255, 255, 255, 0.22);
            color: #fff;
            cursor: pointer;
            transition: background 0.2s ease, transform 0.2s ease;
            &:hover {
              background: rgba(255, 255, 255, 0.4);
              transform: scale(1.06);
            }
          }
        }
      }
      .time {
        font-size: 12px;
        color: var(--td-text-color-secondary);
        opacity: 0.7;
        margin-bottom: 6px;
      }
      .intro {
        height: 100%;
        margin-top: 0;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .footer {
        margin-top: 16px;
        gap: 12px;
        .models {
          gap: 6px;
          min-width: 0;
          overflow: hidden;
          .model {
            font-size: 12px;
            color: var(--td-text-color-secondary);
            max-width: 120px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
        .ops {
          gap: 4px;
          flex-shrink: 0;
          .opBtn {
            width: 28px;
            height: 28px;
            border-radius: var(--td-radius-medium);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: var(--td-text-color-secondary);
            transition: all 0.2s ease;
            &:hover {
              background-color: var(--td-bg-color-container-hover);
              color: var(--td-text-color-primary);
            }
            &:last-child:hover {
              color: var(--td-error-color);
            }
          }
        }
      }
    }
  }
}
:deep(.t-col) {
  height: auto !important;
}
:deep(.t-card__body) {
  display: flex;
  flex-direction: column;
  flex: 1;
}
// 项目诊断弹窗
.diagnosePanel {
  max-height: 60vh;
  overflow: auto;

  .diagnoseSummary {
    padding: 10px 14px;
    border-radius: var(--td-radius-medium);
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 12px;

    &.hasError {
      background: var(--td-error-color-light);
      color: var(--td-error-color);
    }
    &.hasWarn {
      background: var(--td-warning-color-light);
      color: var(--td-warning-color);
    }
    &.allOk {
      background: var(--td-success-color-light);
      color: var(--td-success-color);
    }
  }

  .diagnoseItem {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px solid var(--td-component-stroke);

    &:last-child {
      border-bottom: none;
    }

    .diagnoseBody {
      min-width: 0;
      .diagnoseTitle {
        font-size: 14px;
        font-weight: 600;
        color: var(--td-text-color-primary);
      }
      .diagnoseMsg {
        margin-top: 4px;
        font-size: 14px;
        line-height: 1.6;
        color: var(--td-text-color-secondary);
        word-break: break-all;
      }
    }
  }
}
// 封面类型标签：半透明白底，兼容深色封面
:deep(.coverTypeTag) {
  background-color: rgba(255, 255, 255, 0.16);
  color: #fff;
  border: none;
}
</style>
