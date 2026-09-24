<template>
  <t-card class="workbench" @click="workbenchVisible = !workbenchVisible">
    <div class="titleBar dragHandle pr">
      <div class="title">
        {{ $t("workbench.production.node.workbench.title") }}
        <t-tag size="small" variant="light" style="margin-left: 6px">{{ workbenchData?.videoList?.length ?? 0 }}</t-tag>
      </div>
      <Handle :id="props.handleIds.target" type="target" :position="Position.Left" style="left: calc(-1 * var(--td-comp-paddingLR-xl))" />
      <!-- <Handle :id="props.handleIds.source" type="source" :position="Position.Right" /> -->
    </div>
    <div class="videoPreview">
      <div class="videoPlaceholder">
        <div class="playButton">
          <i-video theme="outline" size="48" />
        </div>
        <div class="videoCount">{{ workbenchData?.videoList?.length ?? 0 }}</div>
      </div>
    </div>
  </t-card>
</template>

<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";

const workbenchVisible = inject<Ref<boolean>>("workbenchVisible")!;

// 与 FlowData.workbench 结构保持一致（{ videoList }），展示视频数量
interface WorkbenchData {
  videoList: {
    id: number;
    prompt: string;
    duration: number;
    storyboardId: number;
    trackId: number;
  }[];
}

const props = defineProps<{
  id: string;
  handleIds: {
    target: string;
    source: string;
  };
}>();

const workbenchData = defineModel<WorkbenchData>({ required: true });
</script>

<style lang="scss" scoped>
.workbench {
  cursor: pointer;
  min-width: 280px;
  user-select: text;
  transition: filter 0.1s;
  &:hover {
    .playButton {
      transform: scale(1.1);
    }
  }
  &:active {
    filter: brightness(0.9);
  }

  .titleBar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    cursor: grab;
    user-select: none;
  }

  .title {
    background-color: #000;
    width: fit-content;
    padding: 5px 10px;
    color: #fff;
    border-radius: 8px 0;
    font-size: 16px;
  }

  .videoPreview {
    margin-bottom: 12px;
  }

  .videoPlaceholder {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 8px;
    overflow: hidden;
    background: var(--app-gradient-accent);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .videoCover {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .playButton {
    position: absolute;
    color: rgba(255, 255, 255, 0.9);
    transition: transform 0.2s;
  }

  .videoCount {
    position: absolute;
    bottom: 8px;
    right: 8px;
    padding: 2px 8px;
    border-radius: 8px 0 0 0;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    font-size: 12px;
  }

  .videoInfo {
    margin-top: 8px;
  }

  .videoName {
    font-size: 14px;
    font-weight: 600;
    color: var(--td-text-color-primary, #333);
    margin-bottom: 4px;
  }

  .videoMeta {
    font-size: 12px;
    color: var(--td-text-color-secondary, #666);

    .divider {
      margin: 0 6px;
      color: var(--td-border-level-1-color, #ddd);
    }
  }
}
</style>
