<template>
  <div class="noteNode">
    <Handle type="source" :position="Position.Right" style="z-index: 999999" />
    <Handle type="target" :position="Position.Left" style="z-index: 999999" />
    <div class="data" @dblclick="editing = true">
      <div class="title ac">
        <i-notes size="14" />
        <span class="titleText">{{ $t("workbench.production.editImage.noteNodeTitle") }}</span>
      </div>
      <div v-if="editing" class="noteEditor">
        <t-textarea
          :value="data.text"
          :autosize="{ minRows: 2, maxRows: 6 }"
          :placeholder="$t('workbench.production.editImage.notePlaceholder')"
          @change="saveText"
          @blur="editing = false" />
      </div>
      <div v-else class="noteText" :class="{ 'is-empty': !data.text }">
        {{ data.text || $t("workbench.production.editImage.notePlaceholder") }}
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
import type { NoteNodeData } from "../../utils/editImageType";

const props = defineProps<{
  id: string;
  data: NoteNodeData;
}>();

const { removeNodes, updateNodeData } = useVueFlow("editImage");

const editing = ref(false);

function saveText(value: any) {
  updateNodeData(props.id, { text: value ?? "" });
}
</script>

<style lang="scss" scoped>
.noteNode {
  width: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;

  .data {
    width: 100%;
    cursor: pointer;
    position: relative;
    background-color: var(--td-warning-color-light, #fff3e0);
    border: 1px dashed var(--td-warning-color, #ed7b2f);
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);

    .title {
      height: 32px;
      padding: 6px 10px;
      display: flex;
      align-items: center;
      gap: 5px;
      border-bottom: 1px dashed rgba(237, 123, 47, 0.35);

      .titleText {
        color: var(--td-text-color-secondary);
        font-weight: 500;
      }
    }

    .noteEditor {
      padding: 8px;
    }

    .noteText {
      padding: 10px;
      font-size: 13px;
      line-height: 1.5;
      color: var(--td-text-color-primary);
      white-space: pre-wrap;
      word-break: break-all;
      min-height: 40px;

      &.is-empty {
        color: var(--td-text-color-placeholder);
      }
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
