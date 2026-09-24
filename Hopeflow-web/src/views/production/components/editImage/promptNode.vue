<template>
  <div class="promptNode">
    <Handle type="source" :position="Position.Right" style="z-index: 999999" />
    <div class="data">
      <div class="title ac">
        <i-comment theme="outline" size="16" fill="#000000" />
        <span class="titleText">{{ $t("workbench.production.editImage.promptNodeTitle") }}</span>
      </div>
      <div class="promptBox">
        <PromptEditor v-model="data.prompt" :references="references" :placeholder="$t('workbench.production.editImage.promptPlaceholder')" />
      </div>
      <t-tooltip theme="primary" :content="$t('workbench.production.editImage.deleteNode')">
        <div class="remove ac" @click="removeNodes(props.id)">
          <i-delete theme="outline" size="18" fill="#fff" />
        </div>
      </t-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position, useVueFlow } from "@vue-flow/core";
import PromptEditor from "@/components/promptEditor.vue";
import type { PromptNodeData, UploadNodeData, GeneratedNodeData } from "../../utils/editImageType";

const props = defineProps<{
  id: string;
  data: PromptNodeData;
}>();

const emit = defineEmits<{
  (e: "prompt-change"): void;
}>();

const { removeNodes, getNodes } = useVueFlow("editImage");

type PromptRef = { type: "image"; src: string };

// 缓存引用，仅当内容真正变化时才替换数组引用，避免 PromptEditor 因无关更新反复重渲染导致输入中断
const cachedReferences = ref<PromptRef[]>([]);

// 从画布中收集所有图片节点（upload 原图 + generated 生成图），作为提示词可引用的参考图
const references = computed<PromptRef[]>(() => {
  const refs: PromptRef[] = [];
  for (const n of getNodes.value) {
    if (n.type === "upload") {
      const src = (n.data as UploadNodeData).image;
      if (src) refs.push({ type: "image", src });
    } else if (n.type === "generated") {
      const src = (n.data as GeneratedNodeData).generatedImage;
      if (src) refs.push({ type: "image", src });
    }
  }
  const prev = cachedReferences.value;
  const isSame = prev.length === refs.length && refs.every((r, i) => prev[i]?.src === r.src);
  if (!isSame) cachedReferences.value = refs;
  return cachedReferences.value;
});

// 提示词变化时通知父组件，将内容同步到连线上的生成节点
watch(
  () => props.data?.prompt,
  () => emit("prompt-change"),
);
</script>

<style lang="scss" scoped>
.promptNode {
  width: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;

  .data {
    width: 100%;
    cursor: pointer;
    position: relative;
    background-color: var(--td-bg-color-container);
    border: 1px solid var(--td-border-level-2-color);
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

    .title {
      height: 34px;
      padding: 7px 10px;
      display: flex;
      align-items: center;
      border-bottom: 1px solid var(--td-border-level-1-color);

      .titleText {
        margin-left: 5px;
        color: var(--td-text-color-secondary);
        font-weight: 500;
      }
    }

    .promptBox {
      height: 160px;
      width: 100%;
      position: relative;
    }

    .remove {
      position: absolute;
      top: 5px;
      right: 5px;
      z-index: 9999;
      padding: 5px;
      border-radius: 10px;
      background-color: rgba(220, 50, 50, 0.7);
      cursor: pointer;
      &:hover {
        background-color: rgba(220, 50, 50, 1);
      }
    }
  }
}
</style>
