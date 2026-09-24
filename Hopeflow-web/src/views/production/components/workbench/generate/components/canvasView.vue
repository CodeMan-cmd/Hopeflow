<template>
  <div class="canvasView">
    <div class="canvasToolbar">
      <t-button size="small" variant="outline" @click="emit('back-to-list')">
        <template #icon>
          <i-list size="16" />
        </template>
        {{ $t("workbench.generate.backToList") }}
      </t-button>
      <!-- 自动 / 手动模式切换 -->
      <t-radio-group v-model="operateMode" size="small" variant="default-filled">
        <t-radio-button value="auto">{{ $t("workbench.generate.autoMode") }}</t-radio-button>
        <t-radio-button value="manual">{{ $t("workbench.generate.manualMode") }}</t-radio-button>
      </t-radio-group>
      <!-- 手动模式工具 -->
      <template v-if="operateMode === 'manual'">
        <t-button size="small" variant="outline" @click="autoConnectAll">
          <template #icon><i-auto-width size="16" /></template>
          {{ $t("workbench.generate.autoConnect") }}
        </t-button>
        <t-button size="small" variant="outline" theme="danger" @click="clearConnections">
          <template #icon><i-close size="16" /></template>
          {{ $t("workbench.generate.clearConnections") }}
        </t-button>
        <t-button size="small" theme="primary" variant="outline" :loading="props.chainRunning" :disabled="props.chainRunning" @click="runChain">
          <template #icon><i-play-once size="16" /></template>
          {{ props.chainRunning ? $t("workbench.generate.chainRunning") : $t("workbench.generate.runChain") }}
        </t-button>
      </template>
    </div>
    <VueFlow
      id="trackCanvasFlow"
      class="trackCanvas"
      :nodes="nodes"
      :nodes-connectable="operateMode === 'manual'"
      :nodes-draggable="true"
      :elements-selectable="operateMode === 'manual'"
      :max-zoom="2"
      :min-zoom="0.3"
      :nodes-focusable="false"
      :edges-focusable="false"
      :edges-updatable="operateMode === 'manual'"
      :elevate-nodes-on-select="true"
      :disable-keyboard-a11y="true"
      :select-nodes-on-drag="false"
      :zoom-on-double-click="false"
      :delete-key-code="null"
      :zoom-activation-key-code="null"
      :pan-activation-key-code="null"
      :selection-key-code="null"
      :multi-selection-key-code="null"
      fit-view-on-init>
      <template #node-track="props">
        <TrackNode
          :id="props.id"
          :index="props.data.index"
          :track="props.data.track"
          :active="props.data.index === activeIndex"
          :selected-src="props.data.selectedSrc"
          :manual="operateMode === 'manual'"
          :duration-max="durationMax"
          @select="emit('select', props.data.index)"
          @update-duration="(d: number) => emit('update-duration', props.data.index, d)"
          @generate="handleGenerateNode(props.data.index)" />
      </template>
      <Background />
      <Controls :show-interactive="false" position="bottom-right" />
    </VueFlow>
  </div>
</template>

<script setup lang="ts">
import { VueFlow, useVueFlow, type Node, type Edge, type Connection } from "@vue-flow/core";
import type { Ref } from "vue";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import TrackNode from "./canvasNode.vue";
import "@/views/production/components/workbench/type/type";
import projectStore from "@/stores/project";

const props = defineProps<{
  trackList: TrackItem[];
  activeIndex: number;
  /** 时长上限（模型支持的最大值） */
  durationMax?: number;
  /** 串联生成进行中（父组件管理，驱动按钮 loading） */
  chainRunning?: boolean;
}>();

const emit = defineEmits<{
  select: [index: number];
  "back-to-list": [];
  "update-duration": [index: number, duration: number];
  "generate-node": [index: number, extra: { id: number; sources: string }[]];
  "generate-chain": [indices: number[], extras: Record<number, { id: number; sources: string }[]>];
}>();

/** 自动 / 手动模式：auto 保持现状（自动按序连线）；manual 参考 ComfyUI 手动连线 */
const operateMode = ref<"auto" | "manual">("auto");

// 画布 store（与生产页主画布隔离：id="trackCanvasFlow"）
const { setEdges, getEdges, addEdges, onNodeDragStop, fitView, onConnect, onNodesInitialized } = useVueFlow("trackCanvasFlow");

const episodesId = inject<Ref<number>>("episodesId");
const { project } = storeToRefs(projectStore());

/** 会话级持久化 key（画布位置/手动连线，随项目+剧集隔离） */
const storageKey = computed(() => `wf-canvas-${project.value?.id ?? 0}-${episodesId?.value ?? 0}`);

function loadPersist(): { positions: Record<string, { x: number; y: number }>; edges: Edge[] } {
  try {
    const raw = sessionStorage.getItem(storageKey.value);
    if (raw) return JSON.parse(raw);
  } catch {
    /* 忽略解析错误 */
  }
  return { positions: {}, edges: [] };
}

/** 节点位置记录（拖拽后持久，防止 trackList 更新导致位置回落；随组件销毁保存到 sessionStorage） */
const persisted = loadPersist();
const nodePositions = ref<Record<string, { x: number; y: number }>>(persisted.positions);

const nodes = computed<Node[]>(() => {
  return props.trackList.map((track, index) => {
    const nid = `track-${track.id ?? index}`;
    return {
      id: nid,
      type: "track",
      position: nodePositions.value[nid] || { x: (index % 10) * 220, y: Math.floor(index / 10) * 240 },
      data: {
        index,
        track,
        selectedSrc: getSelectedVideoSrc(track),
      },
    };
  });
});

/** 自动模式连线：按轨道顺序首尾相连 */
const autoEdges = computed<Edge[]>(() => {
  const list = props.trackList;
  const result: Edge[] = [];
  for (let i = 0; i < list.length - 1; i++) {
    const sourceId = `track-${list[i].id ?? i}`;
    const targetId = `track-${list[i + 1].id ?? i + 1}`;
    result.push({
      id: `edge-${i}`,
      source: sourceId,
      target: targetId,
      type: "smoothstep",
      animated: false,
      style: { stroke: "#667eea", strokeWidth: 1.5 },
    });
  }
  return result;
});

/** 手动模式连线（用户手动连接，随组件销毁保存到 sessionStorage） */
const manualEdges = ref<Edge[]>(persisted.edges);

// 位置/手动连线变化时写入 sessionStorage
watch(
  [nodePositions, manualEdges],
  () => {
    try {
      sessionStorage.setItem(storageKey.value, JSON.stringify({ positions: nodePositions.value, edges: manualEdges.value }));
    } catch {
      /* 存储失败忽略 */
    }
  },
  { deep: true },
);

// 节点初始化完成后注入自动连线（避免 immediate 在节点注册前 setEdges 导致边被丢弃）
// 并补一次 fitView：避免 fit-view-on-init 在节点尺寸未测量时提前执行导致节点不可见
onNodesInitialized(() => {
  if (operateMode.value === "auto") setEdges(autoEdges.value);
  nextTick(() => fitView({ padding: 0.2, duration: 200 }));
});

// 自动模式下：trackList 变化时同步自动边
watch(
  autoEdges,
  (edges) => {
    if (operateMode.value === "auto") setEdges(edges);
  },
  { deep: true },
);

// 模式切换：切换边集合
watch(operateMode, (mode) => {
  if (mode === "auto") {
    // 自动模式：覆盖为自动按序连线
    setEdges(autoEdges.value);
  } else {
    // 手动模式：恢复用户手动连线（首次进入为空）
    setEdges(manualEdges.value);
    fitView({ padding: 0.2, duration: 300 });
  }
});

/** 手动连线校验：仅允许 输出(prompt/video) → 输入(ref-image) */
onConnect((params: Connection) => {
  const validSource = params.sourceHandle === "prompt" || params.sourceHandle === "video";
  const validTarget = params.targetHandle === "ref-image";
  if (!validSource || !validTarget) {
    window.$message.warning($t("workbench.generate.connectTypeMismatch"));
    return;
  }
  addEdges({
    id: `edge-${Date.now()}`,
    source: params.source,
    target: params.target,
    sourceHandle: params.sourceHandle,
    targetHandle: params.targetHandle,
    type: "smoothstep",
    animated: false,
    style: { stroke: "#667eea", strokeWidth: 1.5 },
  });
  // 同步到手动边列表（后续切换模式可恢复）
  manualEdges.value = [...getEdges.value];
});

/** 一键自动连线（手动模式工具）：按序首尾相连 */
function autoConnectAll() {
  manualEdges.value = [...autoEdges.value];
  setEdges(manualEdges.value);
  fitView({ padding: 0.2, duration: 300 });
}

/** 清除全部连线（手动模式工具） */
function clearConnections() {
  manualEdges.value = [];
  setEdges([]);
}

/** 节点拖拽后记录位置，防止 trackList 更新时位置回落 */
onNodeDragStop(({ nodes: dragged }) => {
  for (const node of dragged) {
    nodePositions.value[node.id] = { x: node.position.x, y: node.position.y };
  }
});

/** 节点 id → track 索引 */
function indexOfNodeId(nodeId: string): number {
  return props.trackList.findIndex((t, i) => `track-${t.id ?? i}` === nodeId);
}

/** 收集指定节点的入边上游参考资源（source 端 medias 中有效的图片/素材 id） */
function collectUpstreamResources(nodeId: string): { id: number; sources: string }[] {
  const extra: { id: number; sources: string }[] = [];
  for (const edge of manualEdges.value) {
    if (edge.target !== nodeId) continue;
    const srcIndex = indexOfNodeId(edge.source);
    const srcTrack = props.trackList[srcIndex];
    if (!srcTrack?.medias) continue;
    for (const m of srcTrack.medias) {
      if (m.src && typeof m.id === "number" && !isNaN(m.id)) {
        extra.push({ id: m.id, sources: (m as TrackMedia).sources || "assets" });
      }
    }
  }
  return extra;
}

/** 点对点生成：生成指定节点视频，附带其入边上游资源 */
function handleGenerateNode(index: number) {
  const nodeId = `track-${props.trackList[index]?.id ?? index}`;
  const extra = collectUpstreamResources(nodeId);
  emit("generate-node", index, extra);
}

/** 串联生成：从选中节点开始，沿连线（出边）顺序收集序列，交给父组件逐个生成 */
function runChain() {
  if (props.chainRunning) return;
  const startIndex = props.activeIndex;
  if (startIndex < 0 || startIndex >= props.trackList.length) {
    window.$message.warning($t("workbench.generate.selectTrackFirst"));
    return;
  }
  // 沿出边做 BFS，得到串联顺序（严格依赖：上游先于下游）
  const startId = `track-${props.trackList[startIndex]?.id ?? startIndex}`;
  const visited = new Set<string>([startId]);
  const order: string[] = [startId];
  const queue = [startId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const edge of manualEdges.value) {
      if (edge.source !== cur || visited.has(edge.target)) continue;
      visited.add(edge.target);
      order.push(edge.target);
      queue.push(edge.target);
    }
  }
  const indices = order.map(indexOfNodeId).filter((i) => i >= 0);
  if (!indices.length) {
    window.$message.warning($t("workbench.generate.selectTrackFirst"));
    return;
  }
  const extras: Record<number, { id: number; sources: string }[]> = {};
  for (const id of order) {
    const idx = indexOfNodeId(id);
    if (idx >= 0) extras[idx] = collectUpstreamResources(id);
  }
  emit("generate-chain", indices, extras);
}

/** 优先展示选中视频 src，否则回退到第一张参考图 */
function getSelectedVideoSrc(track: TrackItem): string | null {
  if (track.selectVideoId && track.videoList.length) {
    const selected = track.videoList.find((v) => v.id === track.selectVideoId);
    if (selected?.src) return selected.src;
  }
  const img = track.medias?.find((m) => m.src && m.fileType === "image");
  return img?.src ?? null;
}
</script>

<style lang="scss" scoped>
.canvasView {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;

  .canvasToolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 0 8px;
  }

  .trackCanvas {
    flex: 1;
    min-height: 0;
    border-radius: 8px;
    border: 1px solid var(--td-component-border, #dcdcdc);
  }
}
</style>
