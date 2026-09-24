<template>
  <t-dialog
    :footer="false"
    :header="false"
    :closeBtn="false"
    v-model:visible="visible"
    attach="body"
    placement="center"
    mode="full-screen"
    class="fullscreenDialog">
    <div class="closure">
      <i-close-small theme="outline" size="24" fill="#4a4a4a" @click="closeFn" />
    </div>
    <VueFlow
      id="editImage"
      class="editImageCls"
      v-model:nodes="nodes"
      v-model:edges="edges"
      :min-zoom="0.01"
      fit-view-on-init
      @connect="onConnect"
      @edges-change="syncReferences">
      <template #node-upload="{ id, data }">
        <uploadNode :id="id" :data="data" @upload="syncReferences" @keep="sureNode" />
      </template>

      <template #node-prompt="{ id, data }">
        <promptNode :id="id" :data="data" @prompt-change="syncReferences" />
      </template>

      <template #node-note="{ id, data }">
        <noteNode :id="id" :data="data" />
      </template>

      <template #node-generated="{ id, data }">
        <generatedNode :id="id" :data="data" :projectId="+project!.id" @keep="sureNode" />
      </template>
      <template #edge-removeLine="edgeProps">
        <removeLine v-bind="edgeProps" />
      </template>
      <Background></Background>
      <Controls />

      <Panel position="top-left">
        <div class="ac" style="gap: 8px">
          <t-radio-group v-model="addNodeType" size="small" variant="default-filled" @change="handleAddNode">
            <t-radio-button value="upload">
              <template #default>
                <i-pic size="14" />
                <span class="addNodeLabel">{{ $t("workbench.production.editImage.upload") }}</span>
              </template>
            </t-radio-button>
            <t-radio-button value="prompt">
              <template #default>
                <i-comment size="14" />
                <span class="addNodeLabel">{{ $t("workbench.production.editImage.promptNodeTitle") }}</span>
              </template>
            </t-radio-button>
            <t-radio-button value="generated">
              <template #default>
                <i-flashlight size="14" />
                <span class="addNodeLabel">{{ $t("workbench.production.editImage.generate") }}</span>
              </template>
            </t-radio-button>
            <t-radio-button value="note">
              <template #default>
                <i-notes size="14" />
                <span class="addNodeLabel">{{ $t("workbench.production.editImage.noteNodeTitle") }}</span>
              </template>
            </t-radio-button>
          </t-radio-group>
          <t-tooltip theme="primary" :content="$t('workbench.production.editImage.fitView')">
            <t-button class="guide-layout-btn" @click="fitView({ duration: 300 })" variant="outline" shape="circle">
              <template #icon>
                <i-full-screen />
              </template>
            </t-button>
          </t-tooltip>
          <t-tooltip theme="primary" :content="$t('workbench.production.autoLayoutLR')">
            <t-button class="guide-layout-btn" @click="layoutGraph('LR')" variant="outline" shape="circle">
              <template #icon>
                <i-tree-diagram />
              </template>
            </t-button>
          </t-tooltip>
          <t-tooltip theme="primary" :content="$t('workbench.production.save')">
            <t-button class="guide-layout-btn" @click="handleToolbarSave" :loading="saveLoading" variant="outline" shape="circle">
              <template #icon>
                <i-save />
              </template>
            </t-button>
          </t-tooltip>
        </div>
      </Panel>
    </VueFlow>
    <storyboardImageCheck telepor v-model="storyboardVisible" :scriptId="episodesId!" @confirm="onStoryboardConfirm" @cancel="onStoryboardCancel" />
  </t-dialog>
</template>

<script setup lang="ts">
import type { Ref } from "vue";
import { VueFlow, useVueFlow, Panel, type Edge } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import uploadNode from "./uploadNode.vue";
import promptNode from "./promptNode.vue";
import noteNode from "./noteNode.vue";
import generatedNode from "./generatedNode.vue";
import storyboardImageCheck from "@/components/storyboardImageCheck.vue";
import type { Storyboard } from "../../utils/flowBuilder";

import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import "@vue-flow/controls/dist/style.css";
import removeLine from "./removeLine.vue";
import projectStore from "@/stores/project";

import axios from "@/utils/axios";
import type { NodeType, UploadNodeData, GeneratedNodeData, NodePromptData } from "../../utils/editImageType";
import { DEFAULT_EDGE_OPTIONS, createGeneratedData, createPromptData, createNoteData, cleanNodes, cleanEdges } from "../../utils/editImageType";
import { useLayout } from "../../utils/dagre";
import { v4 as uuid } from "uuid";

const episodesId = inject<Ref<number>>("episodesId");
const { project } = storeToRefs(projectStore());

// ---- storyboardImageCheck 统一管理 ----
const storyboardVisible = ref(false);
let storyboardResolve: ((rows: Storyboard[]) => void) | null = null;

provide("openStoryboardCheck", openStoryboardCheck);

const { toObject, fromObject, fitView } = useVueFlow({ id: "editImage" });
const { layout } = useLayout("editImage");

const props = withDefaults(
  defineProps<{
    flowData: {
      flowId?: number | null;
      resultImages: { src: string; prompt: string }[]; // 结果图 url 和提示词
      referanceImages: string[]; // 参考图url
    };
    type?: string;
  }>(),
  {
    flowData: () => ({
      resultImages: [],
      referanceImages: [],
    }),
  },
);

const emit = defineEmits(["save"]);

const visible = defineModel({
  type: Boolean,
  default: false,
});
const { addEdges, getNodes, getEdges, updateNodeData } = useVueFlow("editImage");

const nodes = ref<NodeType[]>([]);
const edges = ref<Edge<any, any, string>[]>([]);

// 防抖定时器
let syncTimer: ReturnType<typeof setTimeout> | null = null;
function openStoryboardCheck(): Promise<Storyboard[]> {
  storyboardVisible.value = true;
  return new Promise<Storyboard[]>((resolve) => {
    storyboardResolve = resolve;
  });
}

function onStoryboardConfirm(rows: Storyboard[]) {
  storyboardVisible.value = false;
  storyboardResolve?.(rows);
  storyboardResolve = null;
}

function onStoryboardCancel() {
  storyboardVisible.value = false;
  storyboardResolve?.([]);
  storyboardResolve = null;
}

// 根据当前连线，将 upload 节点的图片同步到 generated 节点的 references
function syncReferences() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(_doSyncReferences, 60);
}

function _doSyncReferences() {
  const allNodes = getNodes.value;
  const allEdges = getEdges.value;

  // 用 Map 预索引节点，避免重复 find（O(n) → O(1)）
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

  // 按 target 分组 edges，减少重复遍历
  const edgesByTarget = new Map<string, string[]>();
  for (const e of allEdges) {
    const list = edgesByTarget.get(e.target);
    if (list) list.push(e.source);
    else edgesByTarget.set(e.target, [e.source]);
  }

  // 找出所有 generated 节点并同步 references 与 prompt
  for (const genNode of allNodes) {
    if (genNode.type !== "generated") continue;

    const sourceIds = edgesByTarget.get(genNode.id) ?? [];
    const connectedImages = sourceIds
      .map((id) => nodeMap.get(id))
      .filter((n): n is NonNullable<typeof n> => !!n)
      .map((n) => {
        if (n.type === "upload") {
          return { image: (n.data as UploadNodeData).image || "" };
        } else if (n.type === "generated") {
          return { image: (n.data as GeneratedNodeData).generatedImage || "" };
        }
        return { image: "" };
      })
      .filter((i) => i.image);

    // 仅在数据变化时才更新，避免无效的响应式触发
    const currentRefs: { image: string }[] = (genNode.data as GeneratedNodeData).references ?? [];
    const isSame = currentRefs.length === connectedImages.length && connectedImages.every((img, idx) => currentRefs[idx]?.image === img.image);
    if (!isSame) {
      updateNodeData(genNode.id, { references: connectedImages });
    }

    // 将连入的 prompt 节点内容同步到 generated 节点（无 prompt 来源时保持原值）
    const promptSource = sourceIds
      .map((id) => nodeMap.get(id))
      .find((n) => n?.type === "prompt") as NodePromptData | undefined;
    if (promptSource) {
      const promptVal = promptSource.data?.prompt ?? "";
      if ((genNode.data as GeneratedNodeData).prompt !== promptVal) {
        updateNodeData(genNode.id, { prompt: promptVal });
      }
    }
  }
}

// 连接处理
const onConnect = (params: any) => {
  // 禁止自己连接自己
  if (params.source === params.target) return;

  // 禁止重复连线及反向连线：A→B 或 B→A 已存在则忽略
  const isDuplicate = getEdges.value.some(
    (e) => (e.source === params.source && e.target === params.target) || (e.source === params.target && e.target === params.source),
  );
  if (isDuplicate) return;

  addEdges([
    {
      id: uuid(),
      source: params.source,
      target: params.target,
      ...DEFAULT_EDGE_OPTIONS,
    },
  ]);
  // 连线建立后立即同步
  nextTick(syncReferences);
};
const addNodeType = ref<"upload" | "prompt" | "generated" | "note">("upload");
// 分段按钮点击：添加对应类型的节点，并重置回默认项
function handleAddNode(value: any) {
  addUploadNode(value);
  addNodeType.value = "upload";
}
// 添加新的上传节点；传入 position 时按指定位置放置（用于提示词卡片与生成图片对齐）
const addUploadNode = (type: string, image: string = "", prompt: string = "", position?: { x: number; y: number }) => {
  const newNodeId = uuid();
  const lastNode = nodes.value.filter((n) => n.type === type).pop();
  const newY = lastNode ? lastNode.position.y + 350 : 100;
  // 默认三列等距布局：upload(0) / prompt(340) / generated(680)，卡片宽 320 互不重叠；指定 position 时以传入为准
  const newX = type === "generated" ? 680 : type === "prompt" ? 340 : type === "note" ? 680 : 0;

  nodes.value.push({
    id: newNodeId,
    type,
    position: position ?? { x: newX, y: newY },
    data:
      type === "generated"
        ? createGeneratedData(image, prompt)
        : type === "prompt"
          ? createPromptData(prompt)
          : type === "note"
            ? createNoteData()
            : { image },
  } as NodeType);

  return newNodeId;
};
//保存节点
async function sureNode(imageUrl: string) {
  try {
    const payload = {
      nodes: cleanNodes(getNodes.value as NodeType[]),
      edges: cleanEdges(getEdges.value),
    };

    if (props.flowData.flowId) {
      await axios.post("/production/editImage/updateImageFlow", { ...payload, flowId: props.flowData.flowId });
      emit("save", { imageUrl, flowId: props.flowData.flowId });
    } else {
      const { data } = await axios.post("/production/editImage/saveImageFlow", { ...payload });
      emit("save", { imageUrl, flowId: data?.id });
    }
    visible.value = false;
  } catch (e) {
    window.$message.error((e as any).message || $t("workbench.production.editImage.saveFailed"));
  }
}

// 工具栏保存：持久化当前 flow，不关闭对话框
const saveLoading = ref(false);
async function handleToolbarSave() {
  if (saveLoading.value) return;
  saveLoading.value = true;
  try {
    const payload = {
      nodes: cleanNodes(getNodes.value as NodeType[]),
      edges: cleanEdges(getEdges.value),
    };
    if (props.flowData.flowId) {
      await axios.post("/production/editImage/updateImageFlow", { ...payload, flowId: props.flowData.flowId });
    } else {
      const { data } = await axios.post("/production/editImage/saveImageFlow", { ...payload });
      props.flowData.flowId = data?.id;
    }
    window.$message.success($t("workbench.production.editImage.saveSuccess"));
  } catch (e) {
    window.$message.error((e as any).message || $t("workbench.production.editImage.saveFailed"));
  } finally {
    saveLoading.value = false;
  }
}
onMounted(async () => {
  try {
    if (!props.flowData.flowId) return buildFlow();
    const { data } = await axios.post("/production/editImage/getImageFlow", {
      id: props.flowData.flowId,
    });
    if (!data) return buildFlow();
    edges.value = data.edges.map((e: any) => ({ ...e, ...DEFAULT_EDGE_OPTIONS }));
    nodes.value = data.nodes;
    // 兜底：加载的 flow 中缺少生成节点时，用分镜预填的数据补建，避免页面无“图片生成”卡片
    if (!nodes.value.some((n) => n.type === "generated") && props.flowData.resultImages?.length) {
      const ri = props.flowData.resultImages[0];
      addUploadNode("generated", ri.src, ri.prompt);
    }
    // 兜底：生成节点已存在但提示词为空时，补填分镜的图片提示词
    const fallbackPrompt = props.flowData.resultImages?.[0]?.prompt;
    if (fallbackPrompt) {
      nodes.value.forEach((n) => {
        if (n.type === "generated" && !(n.data as GeneratedNodeData).prompt) {
          (n.data as GeneratedNodeData).prompt = fallbackPrompt;
        }
      });
    }
    // 兜底：旧 flow 缺少提示词卡片节点时，为每个生成节点补建提示词卡片并连线
    if (!nodes.value.some((n) => n.type === "prompt")) {
      const generatedNodes = nodes.value.filter((n) => n.type === "generated");
      generatedNodes.forEach((g) => {
        const pid = addUploadNode("prompt", "", fallbackPrompt ?? (g.data as GeneratedNodeData).prompt ?? "");
        edges.value.push({
          id: uuid(),
          source: pid,
          target: g.id,
          ...DEFAULT_EDGE_OPTIONS,
        });
      });
    }
    // 等节点渲染出真实尺寸后自动布局，避免旧数据节点叠加、连线穿卡
    await nextTick();
    syncReferences();
    layoutGraph("LR");
  } catch (e) {
    window.$message.error((e as any).message || $t("workbench.production.editImage.fetchFailed"));
  }
});

function buildFlow() {
  const uploadIds: string[] = [];
  const generatedIds: string[] = [];
  props.flowData.referanceImages.forEach((i: string) => {
    uploadIds.push(addUploadNode("upload", i));
  });
  props.flowData.resultImages.forEach((i: { src: string; prompt: string }) => {
    const gid = addUploadNode("generated", i.src, i.prompt);
    generatedIds.push(gid);
    // 为每条生成节点创建独立的提示词卡片，并与其连线（位置交由自动布局计算）
    const pid = addUploadNode("prompt", "", i.prompt);
    edges.value.push({
      id: uuid(),
      source: pid,
      target: gid,
      ...DEFAULT_EDGE_OPTIONS,
    });
  });
  // 将每个 upload 节点连接到每个 generated 节点
  for (const sourceId of uploadIds) {
    for (const targetId of generatedIds) {
      edges.value.push({
        id: uuid(),
        source: sourceId,
        target: targetId,
        ...DEFAULT_EDGE_OPTIONS,
      });
    }
  }
  // 等节点渲染出真实尺寸后自动布局（LR）：upload/prompt 在左列、generated 在右列，连线不穿卡、不重叠
  nextTick(() => {
    syncReferences();
    layoutGraph("LR");
  });
}

function closeFn() {
  const dialog = DialogPlugin.confirm({
    header: $t("workbench.production.editImage.closeConfirmTitle"),
    body: $t("workbench.production.editImage.closeConfirmBody"),
    confirmBtn: $t("common.confirm"),
    cancelBtn: $t("common.cancel"),
    onConfirm: () => {
      if (props.flowData.flowId) {
        const payload = {
          flowId: props.flowData.flowId,
          nodes: cleanNodes(getNodes.value as NodeType[]),
          edges: cleanEdges(getEdges.value),
        };
        axios.post("/production/editImage/updateImageFlow", { ...payload });
      }
      visible.value = false;
      dialog.destroy();
    },
  });
}
async function layoutGraph(direction: "LR" | "TB") {
  const oldData = toObject();
  oldData.nodes = layout(oldData.nodes, oldData.edges, direction);
  await fromObject(oldData);
  await nextTick();
  fitView({ duration: 300 });
}
</script>

<style lang="scss" scoped>
.fullscreenDialog {
  .closure {
    position: absolute;
    margin-top: 10px;
    top: var(--td-comp-paddingTB-xl);
    right: var(--td-comp-paddingLR-xxl);
    z-index: 9999;
    cursor: pointer;
  }
  .editImageCls {
    width: 100%;
  }
}

:deep(.fullscreenDialog) {
  .t-dialog__header {
    display: none !important;
  }
  .t-dialog__body {
    padding: 0 !important;
  }
  .t-dialog__wrap {
    padding: 0 !important;
  }
}
.item {
  width: 45px;
  padding: 5px;
  color: var(--mainColor);
  &:hover {
    background-color: var(--td-bg-color-container-hover);
    border-radius: 4px;
    cursor: pointer;
  }
}

$handelSize: 12px;

:deep(.source) {
  height: $handelSize;
  width: $handelSize;
}
:deep(.target) {
  height: $handelSize;
  width: $handelSize;
}
// 分段按钮里的图标+文字
.addNodeLabel {
  margin-left: 4px;
  line-height: 1;
}
</style>
