<template>
  <t-card class="generateResults">
    <Handle type="target" :position="Position.Left" />
    <!-- 标题栏 -->
    <div class="header">
      <div class="title">
        <i-pic theme="outline" size="16" />
        <span>{{ $t('workbench.production.editImage.generatedResult') }}</span>
      </div>
      <div class="toolbar">
        <i-full-screen-one theme="outline" size="18" class="toolbarIcon" />
        <i-download theme="outline" size="18" class="toolbarIcon" />
      </div>
    </div>

    <div class="content">
      <div class="generatedImageWrapper">
        <img v-if="data.generateResults" :src="data.generateResults" class="generatedImage" />
        <div v-else class="placeholder">{{ $t('workbench.production.editImage.waitingGenerate') }}</div>
        <t-tag v-if="data.generateResults" class="imageTag">{{ $t('workbench.production.editImage.generatedResult') }}</t-tag>
      </div>
    </div>
  </t-card>
</template>

<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
const props = defineProps<{
  id: string;
  data: {
    generateResults?: string;
  };
}>();
</script>

<style lang="scss" scoped>
.generateResults {
  min-width: 380px;
  max-width: 420px;
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;

    .title {
      display: flex;
      align-items: center;
      gap: 6px;
      background-color: var(--td-text-color-primary);
      width: fit-content;
      padding: 5px 10px;
      color: var(--td-text-color-anti);
      border-radius: 8px 0;
      font-size: 14px;
    }

    .toolbar {
      display: flex;
      gap: 8px;

      .toolbarIcon {
        color: var(--td-text-color-secondary);
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: all 0.2s;

        &:hover {
          color: var(--td-text-color-primary);
          background: var(--td-bg-color-container-hover);
        }
      }
    }
  }
  .content {
    .generatedImageWrapper {
      position: relative;
      margin-bottom: 12px;
      border-radius: 8px;
      overflow: hidden;

      .generatedImage {
        width: 100%;
        display: block;
      }

      .placeholder {
        width: 100%;
        height: 200px;
        background: linear-gradient(135deg, var(--td-bg-color-secondarycontainer) 0%, var(--td-bg-color-component) 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--td-text-color-placeholder);
        font-size: 14px;
      }

      .imageTag {
        position: absolute;
        right: 8px;
        bottom: 8px;
        background: rgba(0, 0, 0, 0.6);
        color: #fff;
        border: none;
      }
    }
  }
}
</style>
