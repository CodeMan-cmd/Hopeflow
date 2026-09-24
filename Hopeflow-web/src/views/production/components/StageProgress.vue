<template>
  <div class="stageProgress">
    <div class="stageRow">
      <div
        v-for="item in stages"
        :key="item.key"
        class="stageItem"
        :class="[`is-${item.state}`, { blocked: isBlocked(item.key) }]"
        @click="emit('focus', item.node)">
        <span class="stageDot">{{ item.state === "done" ? "✓" : item.state === "failed" ? "!" : item.done > 0 ? "◐" : "○" }}</span>
        <span class="stageLabel">{{ stageLabel(item) }}</span>
        <span class="stageCount">{{ item.done }}/{{ item.total }}</span>
        <t-tooltip :content="item.detail" placement="bottom" />
      </div>
      <t-button size="small" variant="text" :loading="loading" @click="load">
        <template #icon><i-refresh size="14" /></template>
      </t-button>
    </div>

    <!-- 卡住跳步：把「上一步产物缺失」显式说出来，而不是让用户自己发现 -->
    <div v-if="blockers.length" class="blockerRow">
      <span class="blockerIcon">!</span>
      <t-tooltip :content="blockerTooltip" placement="bottom-left">
        <span class="blockerText">{{ blockers[0].message }}</span>
      </t-tooltip>
      <t-button size="small" theme="warning" variant="text" @click="emit('focus', blockers[0].node)">
        {{ blockers[0].actionLabel }}
      </t-button>
      <t-tag v-if="blockers.length > 1" size="small" variant="light">
        +{{ blockers.length - 1 }}
      </t-tag>
    </div>

    <!-- 全自动模式：让「下一步会自动做什么」可见 -->
    <div v-if="autoMode" class="autoRow">
      <t-tag size="small" theme="success" variant="light">{{ $t("workbench.production.stage.autoRunning") }}</t-tag>
      <span class="autoNext">
        {{ nextStep ? $t("workbench.production.stage.autoNext", { stage: stageLabelByName(nextStep.label) }) : $t("workbench.production.stage.autoDone") }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
import projectStore from "@/stores/project";
import productionAgentStore from "@/stores/productionAgent";

interface Stage {
  key: string;
  label: string;
  state: "empty" | "pending" | "partial" | "done" | "failed";
  done: number;
  total: number;
  detail: string;
  node: string;
}

interface Blocker {
  code: string;
  message: string;
  stage: string;
  node: string;
  actionLabel: string;
}

const emit = defineEmits<{ (e: "focus", node: string): void }>();

const { project } = storeToRefs(projectStore());
const { episodesId, autoMode, flowData } = storeToRefs(productionAgentStore());

const stages = ref<Stage[]>([]);
const blockers = ref<Blocker[]>([]);
const nextStep = ref<{ stage: string; label: string; node: string; detail: string } | null>(null);
const loading = ref(false);

const blockerTooltip = computed(() => blockers.value.map((b) => b.message).join("\n"));

function isBlocked(stageKey: string) {
  return blockers.value.some((b) => b.stage === stageKey);
}

/** 阶段文案以 i18n 为准，后端 label 只作兜底（后端返回的是中文） */
function stageLabel(item: Stage) {
  const key = `workbench.production.stage.name.${item.key}`;
  const label = $t(key);
  return label === key ? item.label : label;
}

function stageLabelByName(label: string) {
  const hit = stages.value.find((s) => s.label === label || stageLabel(s) === label);
  return hit ? stageLabel(hit) : label;
}

async function load() {
  if (!project.value?.id) return;
  loading.value = true;
  try {
    const { data } = await axios.post("/production/getStageStatus", {
      projectId: Number(project.value.id),
      scriptId: episodesId.value ? Number(episodesId.value) : undefined,
    });
    stages.value = data?.stages ?? [];
    blockers.value = data?.blockers ?? [];
    nextStep.value = data?.nextStep ?? null;
  } catch {
    // 看板失败不该打断创作，静默降级
  } finally {
    loading.value = false;
  }
}

// 全自动模式下轮询，让六阶段进度真的「动起来」；手动模式下只在挂载/切集时刷新
let timer: ReturnType<typeof setInterval> | null = null;

watch(
  [autoMode, () => project.value?.id],
  ([isAuto]) => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (isAuto) {
      timer = setInterval(load, 5000);
    }
  },
  { immediate: true },
);

watch(episodesId, load);
onMounted(load);
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});

// 画布上的产物数量变了就刷新一次，避免「生成了但看板还是 0/35」
watch(
  () => [flowData.value?.assets?.length ?? 0, flowData.value?.storyboard?.length ?? 0],
  () => load(),
);

defineExpose({ load });
</script>

<style lang="scss" scoped>
.stageProgress {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--td-bg-color-container);
  box-shadow: var(--td-shadow-1);
}

.stageRow {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.stageItem {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--td-text-color-secondary);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
  transition: background 0.15s ease;

  &:hover {
    background: var(--td-bg-color-container-hover);
  }

  .stageDot {
    font-weight: 700;
  }

  .stageCount {
    color: var(--td-text-color-placeholder);
  }

  &.is-done {
    color: var(--td-success-color);
    .stageDot {
      color: var(--td-success-color);
    }
  }

  &.is-partial,
  &.is-pending {
    color: var(--td-warning-color);
  }

  &.is-failed,
  &.blocked {
    color: var(--td-error-color);
  }
}

.blockerRow {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--td-error-color);

  .blockerIcon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--td-error-color);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
  }

  .blockerText {
    max-width: 420px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.autoRow {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--td-text-color-secondary);
}
</style>
