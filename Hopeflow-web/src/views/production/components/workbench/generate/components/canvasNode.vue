<template>
  <div class="canvasNode" :class="{ active, 'is-running': isRunning, 'is-manual': manual }" @click="emit('select')">
    <!-- 手动模式：左侧参考图输入端口（类型 IMAGE） -->
    <Handle
      v-if="manual"
      id="ref-image"
      type="target"
      :position="Position.Left"
      class="nodeHandle handle-image"
      :title="$t('workbench.generate.portRefImage')" />
    <div class="nodeHeader">
      <t-tag size="small" variant="light" class="indexTag">#{{ index + 1 }}</t-tag>
      <t-tag size="small" :theme="stateTheme" :class="`stateTag state-${track.state}`">
        {{ stateText }}
      </t-tag>
    </div>
    <!-- 缩略图：优先选中视频，其次参考图，兜底占位图标 -->
    <div class="thumbWrap">
      <img v-if="thumbSrc" :src="thumbSrc" class="thumb" draggable="false" />
      <t-image v-else-if="firstImage" fit="cover" :src="firstImage" class="thumb" />
      <div v-else class="thumb placeholder c">
        <i-video size="28" />
      </div>
      <span v-if="track.duration" class="durationTag">{{ track.duration }}s</span>
      <t-loading v-if="isRunning" class="runningMask" size="small" />
    </div>
    <!-- 手动模式：时长参数 Widget -->
    <div v-if="manual" class="paramRow">
      <span class="paramLabel">{{ $t("workbench.generate.duration") }}</span>
      <t-input-number
        class="paramInput"
        size="small"
        theme="column"
        :model-value="track.duration"
        :min="1"
        :max="durationMax"
        @change="onDurationChange" />
    </div>
    <!-- 手动模式：点对点生成当前分镜视频 -->
    <div v-if="manual" class="genRow" @click.stop>
      <t-button
        size="small"
        theme="primary"
        variant="outline"
        block
        :loading="isRunning"
        :disabled="isRunning"
        @click="emit('generate')">
        <template #icon><i-video size="16" /></template>
        {{ $t("workbench.generate.generateNode") }}
      </t-button>
    </div>
    <!-- 参考素材小图 -->
    <div class="refGroup" v-if="refImages.length">
      <t-image v-for="(m, i) in refImages" :key="i" fit="cover" :src="m" class="refThumb" />
    </div>
    <div class="nodePrompt" v-if="track.prompt">{{ track.prompt }}</div>
    <div class="nodePrompt placeholder" v-else>{{ $t("workbench.generate.noVideo") }}</div>
    <!-- 手动模式：右侧输出端口（提示词 / 视频） -->
    <template v-if="manual">
      <Handle
        id="prompt"
        type="source"
        :position="Position.Right"
        class="nodeHandle handle-prompt"
        :title="$t('workbench.generate.portPrompt')"
        :style="{ top: '38%' }" />
      <Handle
        id="video"
        type="source"
        :position="Position.Right"
        class="nodeHandle handle-video"
        :title="$t('workbench.generate.portVideo')"
        :style="{ top: '62%' }" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import "@/views/production/components/workbench/type/type";

const props = defineProps<{
  id: string;
  index: number;
  track: TrackItem;
  active: boolean;
  selectedSrc: string | null;
  /** 手动模式：显示端口与参数 Widget */
  manual?: boolean;
  /** 时长上限（由模型支持范围决定） */
  durationMax?: number;
}>();

const emit = defineEmits<{
  select: [];
  "update-duration": [duration: number];
  generate: [];
}>();

/** 运行态：提示词生成中 或 存在视频生成中（画布高亮/按钮 loading 依据） */
const isRunning = computed(() => {
  if (props.track.state === "生成中") return true;
  return (props.track.videoList || []).some((v) => v.state === "生成中");
});

/** 节点状态文案：优先识别视频生成中，其次提示词生成中，否则用 track.state */
const stateText = computed(() => {
  if (isRunning.value) return $t("workbench.generate.generating");
  const map: Record<string, string> = {
    未生成: $t("workbench.generate.notGenerated"),
    生成中: $t("workbench.generate.generating"),
    已完成: $t("workbench.generate.generated"),
    生成失败: $t("workbench.generate.generateFailed"),
  };
  return map[props.track.state] || props.track.state;
});

const stateTheme = computed(() => {
  if (isRunning.value) return "primary";
  const map: Record<string, string> = {
    未生成: "default",
    生成中: "primary",
    已完成: "success",
    生成失败: "danger",
  };
  return (map[props.track.state] || "default") as "default" | "primary" | "success" | "danger";
});

/** 手动模式时长 Widget 变更回调（t-input-number change 参数类型为 InputNumberValue） */
function onDurationChange(val: unknown) {
  emit("update-duration", Number(val) || 0);
}

/** 优先展示选中视频/参考图；无视频时显示占位 */
const thumbSrc = computed(() => props.selectedSrc || null);

/** 参考图（排除已作为主图展示的那张） */
const refImages = computed(() => {
  if (!props.track.medias?.length) return [];
  const imgs = props.track.medias.filter((m) => m.src && m.fileType === "image").map((m) => m.src!);
  if (thumbSrc.value) return imgs.filter((s) => s !== thumbSrc.value).slice(0, 3);
  return imgs.slice(1, 4);
});

const firstImage = computed(() => {
  if (props.track.medias?.length) {
    const img = props.track.medias.find((m) => m.src && m.fileType === "image");
    if (img?.src) return img.src;
  }
  return "";
});
</script>

<style lang="scss" scoped>
.canvasNode {
  position: relative;
  width: 180px;
  padding: 8px;
  border-radius: 10px;
  background: #fff;
  border: 2px solid var(--td-component-border, #dcdcdc);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  }

  &.active {
    border-color: var(--td-brand-color, #0052d9);
    box-shadow: 0 0 0 2px rgba(0, 82, 217, 0.15);
  }

  &.is-running {
    border-color: var(--td-brand-color, #0052d9);
    animation: runningPulse 1.6s ease-in-out infinite;
  }

  @keyframes runningPulse {
    0%,
    100% {
      box-shadow: 0 0 0 0 rgba(0, 82, 217, 0.25);
    }
    50% {
      box-shadow: 0 0 0 4px rgba(0, 82, 217, 0.35);
    }
  }

  .nodeHandle {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid #fff;

    &.handle-image {
      background: #8a8a8a;
    }
    &.handle-prompt {
      background: #0052d9;
    }
    &.handle-video {
      background: #2ba471;
    }
  }

  .nodeHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;

    .indexTag {
      font-weight: 600;
    }
  }

  .thumbWrap {
    position: relative;
    width: 100%;
    aspect-ratio: 9 / 16;
    max-height: 120px;
    border-radius: 6px;
    overflow: hidden;
    background: var(--td-bg-color-component, #f0f0f0);
    display: flex;
    align-items: center;
    justify-content: center;

    .thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .placeholder {
      color: #999;
    }

    .durationTag {
      position: absolute;
      right: 4px;
      bottom: 4px;
      padding: 1px 6px;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.55);
      color: #fff;
      font-size: 12px;
    }

    .runningMask {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.6);
    }
  }

  .paramRow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    margin-top: 6px;

    .paramLabel {
      font-size: 12px;
      color: var(--td-text-color-secondary, #666);
    }

    .paramInput {
      width: 72px;
    }
  }

  .genRow {
    margin-top: 6px;
  }

  .refGroup {
    display: flex;
    gap: 4px;
    margin-top: 6px;

    .refThumb {
      width: 40px;
      height: 24px;
      border-radius: 4px;
      object-fit: cover;
    }
  }

  .nodePrompt {
    margin-top: 6px;
    font-size: 12px;
    line-height: 1.4;
    color: var(--td-text-color-secondary, #666);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;

    &.placeholder {
      opacity: 0.5;
    }
  }
}
</style>
