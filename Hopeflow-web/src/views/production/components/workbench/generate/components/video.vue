<template>
  <t-card :title="'#' + (activeTrackIndex + 1) + $t('workbench.generate.videoMenu')" header-bordered style="height: 100%">
    <template #actions>
      <t-button size="small" :loading="generating" @click="emit('generate')">{{ $t("workbench.generate.generate") }}</t-button>
    </template>
    <div class="history">
      <div class="titleBox f ac">
        <i-time />
        <span class="title">{{ $t("workbench.generate.history") }}（{{ currentTrack?.videoList.length }}）</span>
      </div>
      <div class="historyItemBox">
        <div
          class="historyItem"
          :class="{ active: v.id === selectVideoId, generating: v.state === '生成中', failed: v.state === '生成失败' }"
          v-for="v in currentTrack?.videoList"
          :key="v.id"
          @click.stop>
          <template v-if="videoCoverMap[v.src]">
            <img :src="videoCoverMap[v.src]" class="videoCover" />
          </template>
          <template v-else-if="v.state !== '生成中' && v.state !== '待下载'">
            <video
              :key="v.src"
              :src="v.src"
              preload="metadata"
              muted
              @loadedmetadata="
                (e: Event) => {
                  (e.target as HTMLVideoElement).currentTime = 0.5;
                }
              "
              @seeked="
                (e: Event) => {
                  const el = e.target as HTMLVideoElement;
                  captureVideoCover(v.src);
                  el.style.display = 'none';
                }
              " />
          </template>
          <div v-if="v.state === '生成中'" class="loadingOverlay c fc">
            <t-loading size="24px" />
            <span class="loadingText">{{ $t("workbench.generate.generating") }}</span>
          </div>
          <t-tooltip v-if="v.state == '生成失败'" placement="top" :content="v?.errorReason! ?? ''" theme="light">
            <t-tag class="stateTag" theme="danger" size="small">
              {{ $t("workbench.generate.generateFailed") }}
            </t-tag>
          </t-tooltip>
          <div v-else-if="v.state === '待下载'" class="loadingOverlay c fc">
            <t-button size="small" theme="primary" :loading="downloadingId === v.id" @click.stop="browserDownload(v)">
              {{ $t("workbench.generate.browserDownload") }}
            </t-button>
          </div>
          <div v-if="v.state !== '生成中'" class="selectBtn" @click.stop="selectVideo(v)">
            <i-check size="16" />
          </div>
          <div class="delBtn" @click.stop="handleDeleteVideo(v)">
            <i-delete size="16" />
          </div>
          <div v-if="v.state !== '生成中' && v.state !== '生成失败' && v.state !== '待下载'" class="download" @click.stop="downloadVideo(v)">
            <i-to-bottom size="16" />
          </div>
          <div v-if="v.state !== '生成中' && v.state !== '生成失败' && v.state !== '待下载'" class="playBtn" @click.stop="openVideoPlayer(v)">
            <i-play size="16" />
          </div>
        </div>
      </div>
    </div>
  </t-card>

  <!-- 视频播放弹窗 -->
  <t-dialog
    v-model:visible="videoPlayerVisible"
    :header="$t('workbench.generate.previewVideo')"
    :footer="false"
    width="800px"
    destroy-on-close
    @close="handlePlayerClose">
    <div class="videoPlayerBox">
      <video v-if="playingVideoSrc" :src="playingVideoSrc" controls autoplay class="videoPlayer" />
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import type { Ref } from "vue";
import axios from "@/utils/axios";
import projectStore from "@/stores/project";

const props = defineProps<{
  activeTrackIndex: number;
  generating?: boolean;
}>();
const currentTrack = defineModel<TrackItem | undefined>("currentTrack", {
  default: undefined,
});
const emit = defineEmits<{
  generate: [];
  refresh: [];
}>();

const { project } = storeToRefs(projectStore());
const episodesId = inject<Ref<number>>("episodesId")!;

const selectVideoId = ref<number | null>(null);
// 同步轨道选中视频到本地选中态（当前轨道切换时更新）
watch(
  () => currentTrack.value?.selectVideoId,
  (val) => {
    selectVideoId.value = val ?? null;
  },
  { immediate: true },
);
const videoCoverMap = ref<Record<string, string>>({});
const videoPlayerVisible = ref(false);
const playingVideoSrc = ref<string>();

/** 选中历史视频并同步到后端 */
async function selectVideo(v: HistoryVideoItem) {
  if (v.state === "生成中" || v.state === "生成失败" || v.state === "待下载") return;
  try {
    await axios.post("/production/workbench/selectVideo", {
      projectId: project.value?.id,
      scriptId: episodesId.value ?? 0,
      videoId: v.id,
      trackId: currentTrack.value?.id,
    });
    window.$message.success($t("workbench.generate.selectVideoSuccess"));
    selectVideoId.value = v.id;
    emit("refresh");
  } catch {
    window.$message.error($t("workbench.generate.selectVideoFailed"));
  }
}

/** 删除某条历史视频 */
function handleDeleteVideo(value: HistoryVideoItem) {
  const dlg = DialogPlugin.confirm({
    header: $t("workbench.generate.del"),
    body: $t("workbench.generate.delVideo"),
    onConfirm: () => {
      axios.post("/production/workbench/delVideo", { id: value.id }).then(() => {
        window.$message.success($t("workbench.generate.delSuccess"));
        emit("refresh");
        dlg.destroy();
        // 本地即时移除该条历史视频，避免刷新前仍显示已删除项
        if (currentTrack.value) {
          const idx = currentTrack.value.videoList.findIndex((item) => item.id == value.id);
          if (idx !== -1) currentTrack.value.videoList.splice(idx, 1);
        }
      });
    },
    onCancel: () => dlg.destroy(),
  });
}

/** 单个视频下载 */
const downloadingSet = new Set<string>();

async function downloadVideo(value: HistoryVideoItem) {
  if (!value?.src) return;
  if (downloadingSet.has(value.src)) {
    window.$message.info("下载进行中，请稍候");
    return;
  }
  downloadingSet.add(value.src);
  try {
    const response = await fetch(value.src);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    // 使用时间戳保证文件名唯一，避免浏览器提示覆盖
    link.download = `视频_${Date.now()}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // 延迟撤销，确保浏览器有时间开始下载（避免立即 revoke 导致问题）
    setTimeout(() => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {}
    }, 60000);
  } catch (err) {
    console.error(err);
    window.$message.error("下载失败");
  } finally {
    downloadingSet.delete(value.src);
  }
}

/** 待下载状态：浏览器下载结果文件并回传保存 */
const downloadingId = ref<number | null>(null);
async function browserDownload(v: HistoryVideoItem) {
  const url = v.errorReason;
  if (!url) {
    window.$message.warning($t("workbench.generate.browserDownloadMissingUrl"));
    return;
  }
  if (!v.id) {
    window.$message.warning($t("workbench.generate.browserDownloadMissingVideo"));
    return;
  }
  downloadingId.value = v.id;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${$t("workbench.generate.browserDownloadHttpFail")}: HTTP ${res.status}`);
    const blob = await res.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error($t("workbench.generate.browserDownloadReadFail")));
      reader.readAsDataURL(blob);
    });
    await axios.post("/production/workbench/saveDownloadedVideo", { videoId: v.id, base64 });
    window.$message.success($t("workbench.generate.browserDownloadSuccess"));
    emit("refresh");
  } catch (e: any) {
    window.$message.error(e?.message ?? $t("workbench.generate.browserDownloadFail"));
  } finally {
    downloadingId.value = null;
  }
}

/** 捕获视频封面（绘制 0.5s 帧到 canvas） */
function captureVideoCover(src: string) {
  if (!src || videoCoverMap.value[src]) return;
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.preload = "auto";
  video.muted = true;
  video.src = src;
  video.addEventListener(
    "seeked",
    () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 160;
        canvas.height = video.videoHeight || 90;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          videoCoverMap.value[src] = canvas.toDataURL("image/jpeg", 0.7);
        }
      } catch {}
      video.src = "";
    },
    { once: true },
  );
  video.addEventListener(
    "loadeddata",
    () => {
      video.currentTime = 0.5;
    },
    { once: true },
  );
  video.addEventListener(
    "error",
    () => {
      video.src = "";
    },
    { once: true },
  );
  video.load();
}

/** 打开视频播放弹窗 */
function openVideoPlayer(v: HistoryVideoItem) {
  if (!v.src) return;
  playingVideoSrc.value = v.src;
  videoPlayerVisible.value = true;
}

/** 关闭播放弹窗时清空 src，停止播放 */
function handlePlayerClose() {
  playingVideoSrc.value = undefined;
}
</script>

<style lang="scss" scoped>
.history {
  height: 100%;
  .titleBox {
    gap: 6px;
    margin-bottom: 8px;
    .title {
      font-size: 14px;
      color: var(--td-text-color-secondary);
    }
  }
  .historyItemBox {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 10px;
    height: 100%;
    .historyItem {
      position: relative;
      width: 130px;
      height: 90px;
      border-radius: 4px;
      overflow: hidden;
      cursor: pointer;
      border: 2px solid transparent;
      background: var(--td-bg-color-secondarycontainer);
      &.active {
        border-color: var(--td-brand-color);
      }
      &.generating {
        cursor: default;
      }
      &.failed {
        cursor: default;
      }
      .videoCover {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      video {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .loadingOverlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        gap: 4px;
        .loadingText {
          font-size: 12px;
          color: #fff;
        }
      }
      .stateTag {
        position: absolute;
        bottom: 4px;
        left: 4px;
      }
      .selectBtn,
      .delBtn,
      .download,
      .playBtn {
        position: absolute;
        display: none;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.55);
        color: #fff;
        cursor: pointer;
      }
      .selectBtn {
        bottom: 4px;
        right: 4px;
      }
      .delBtn {
        top: 4px;
        right: 4px;
      }
      .download {
        bottom: 4px;
        left: 4px;
      }
      .playBtn {
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.55);
      }
      &:hover {
        .selectBtn,
        .delBtn,
        .download,
        .playBtn {
          display: flex;
        }
      }
    }
  }
}

.videoPlayerBox {
  display: flex;
  justify-content: center;
  align-items: center;
  background: #000;
  border-radius: 4px;
  overflow: hidden;
  .videoPlayer {
    width: 100%;
    max-height: 450px;
    outline: none;
  }
}
:deep(.t-card__body) {
  overflow: auto;
  height: calc(100% - 48px);
}
</style>
