<template>
  <div class="videoTrack">
    <t-card bordered :style="{ height: '100%' }">
      <div class="trackMenu f ac jb">
        <div class="left f ac">
          <t-checkbox v-model="checkAll" @change="handleCheckAll">{{ $t("workbench.generate.selectAll") }}</t-checkbox>
          <t-dropdown :options="quickSelectOptions" @click="handleQuickSelect" trigger="click">
            <t-button size="small" variant="text" class="quickSelectBtn">
              {{ $t("workbench.generate.quickSelect") }}
              <template #suffix><i-down size="14" /></template>
            </t-button>
          </t-dropdown>
          <span class="selectedCount" v-if="checkedTrackIds.length">{{ $t("workbench.generate.selected") }} {{ checkedTrackIds.length }} 段</span>
        </div>
        <div class="right f ac">
          <t-button v-if="isFrameMode" size="small" variant="outline" @click="autoFillEndFrame">{{ $t("workbench.generate.autoFillEndFrame") }}</t-button>
          <t-button size="small" variant="outline" @click="props.batchAutoMatchDuration">{{ $t("workbench.generate.autoMatchDuration") }}</t-button>
          <t-button size="small" variant="outline" @click="batchDownloadVideo">{{ $t("workbench.generate.batchDownloadVideo") }}</t-button>
          <t-button size="small" variant="outline" theme="danger" @click="batchDeleteFailedVideos">{{ $t("workbench.generate.batchDeleteFailedVideos") }}</t-button>
          <t-button size="small" variant="outline" @click="batchGenText" :loading="generateTextLoad">
            {{ $t("workbench.generate.batchGenerateText") }}
          </t-button>
          <t-button size="small" variant="outline" @click="batchGenVideo" :loading="generateVideoLoad">
            {{ $t("workbench.generate.batchGenerateVideo") }}
          </t-button>
          <t-tooltip :content="$t('workbench.generate.switchToCanvas')">
            <t-button size="small" variant="outline" @click="emit('viewModeChange', 'canvas')">
              <template #icon><i-transform size="16" /></template>
            </t-button>
          </t-tooltip>
          <!-- <t-button size="small" variant="outline" @click="importVideo">{{ $t("workbench.generate.importVideo") }}</t-button> -->
        </div>
      </div>
      <div class="itemBox">
        <div
          class="item"
          :class="{ active: index === activeTrackIndex }"
          v-for="(track, index) in trackList"
          :key="track.id"
          @click="changeIndex(index)">
          <t-checkbox
            class="trackCheck"
            :checked="track.id != null && checkedTrackIds.includes(track.id)"
            @click.stop
            @change="(val: boolean) => toggleCheck(track.id, val)" />
          <t-tag class="indexTag" size="small">#{{ index + 1 }}</t-tag>
          <t-tag class="selectTag" theme="success" size="small" v-if="track.selectVideoId">已选择</t-tag>
          <!-- 优先展示选中视频的首帧 -->
          <div class="thumbGroup" v-if="track.selectVideoId && getSelectedVideoSrc(track)">
            <img
              v-if="videoCoverMap[getSelectedVideoSrc(track)!]"
              class="thumb selectedVideoThumb"
              :src="videoCoverMap[getSelectedVideoSrc(track)!]"
              draggable="false" />
            <div v-else class="thumb placeholder c">
              <i-video size="24" />
            </div>
          </div>
          <!-- 无选中视频时展示参考素材缩略图 -->
          <div class="thumbGroup" v-else-if="track.medias.some((m) => m.src)">
            <template v-for="(m, i) in (isFrameMode ? track.medias.slice(0, 2) : track.medias)" :key="i">
              <template v-if="m.src">
                <t-image fit="cover" v-if="m.fileType === 'image'" :src="m.src" class="thumb" />
                <div v-else class="thumb placeholder c">
                  <i-volume-notice v-if="m.fileType === 'audio'" size="20" />
                  <i-video v-else size="24" />
                </div>
              </template>
            </template>
          </div>
          <span v-else class="emptyTrack">{{ $t("workbench.generate.emptyTrack", { index: index + 1 }) }}</span>
          <div class="deleteBtn" @click.stop="confirmDeleteTrack(index)">
            <i-close size="14" />
          </div>
        </div>
        <div class="item addItem c" @click="addTrack">
          <i-plus size="36"></i-plus>
        </div>
      </div>
    </t-card>
  </div>
</template>

<script setup lang="ts">
import type { Ref } from "vue";
import "@/views/production/components/workbench/type/type";
import axios from "@/utils/axios";
import projectStore from "@/stores/project";
import imageListCacheStore from "@/stores/imageListCache";
import JSZip from "jszip";
import settingStore from "@/stores/setting";
import { cachedLocale } from "@/locales";

const { otherSetting } = storeToRefs(settingStore());
const { project } = storeToRefs(projectStore());
const { removeCache, setCache } = imageListCacheStore();
const episodesId = inject<Ref<number>>("episodesId")!;
const props = defineProps<{
  modelParmas: ModelSetting;
  imageList: UploadItem[];
  clampDuration: (trackDuration: number) => number;
  autoSelectDuration: (trackDuration: number) => number;
  batchAutoMatchDuration: () => Promise<void>;
}>();
const activeTrackIndex = defineModel("activeTrackIndex", {
  default: 0,
});
const checkedTrackIds = ref<number[]>([]); // 已勾选的轨道 id
const trackList = defineModel<TrackItem[]>({
  default: () => [],
});
const emit = defineEmits<{
  getData: [];
  change: [prevIndex: number];
  saveImageList: [trackId: number];
  viewModeChange: [mode: "list" | "canvas"];
}>();
const checkAll = ref(false); // 全选状态

/** 是否为首尾帧模式 */
const isFrameMode = computed(() => {
  return ["startEndRequired", "endFrameOptional", "startFrameOptional"].includes(props.modelParmas.mode);
});

/** 批量填充尾帧：用下一个分镜头的首帧填充当前轨道的尾帧 */
function autoFillEndFrame() {
  const pid = project.value?.id;
  const sid = episodesId.value;
  let fillCount = 0;

  for (let i = 0; i < trackList.value.length; i++) {
    const track = trackList.value[i];
    // 检查当前轨道是否已有尾帧
    const hasEndFrame = track.medias.length >= 2 && track.medias[1]?.src;
    if (hasEndFrame) continue;

    // 取下一个分镜头的首帧作为当前轨道的尾帧
    const nextTrack = trackList.value[i + 1];
    const nextFirstFrame = nextTrack?.medias.find((m) => m.src);
    if (!nextFirstFrame) continue;

    // 深拷贝下一帧作为尾帧
    const endFrame = JSON.parse(JSON.stringify(nextFirstFrame));

    // 确保 medias 有2项，设置第二项为尾帧
    if (track.medias.length < 2) {
      track.medias.push(endFrame);
    } else {
      track.medias[1] = endFrame;
    }

    // 更新缓存
    if (pid != null && sid != null && track.id != null) {
      setCache(pid, sid, track.id, track.medias);
    }
    fillCount++;
  }

  if (fillCount > 0) {
    window.$message.success($t("workbench.generate.autoFillEndFrameSuccess", { count: fillCount }));
  } else {
    window.$message.info($t("workbench.generate.autoFillEndFrameEmpty"));
  }
}

/** 视频封面缓存 src -> dataURL */
const videoCoverMap = ref<Record<string, string>>({});

/** 获取轨道选中视频的 src */
function getSelectedVideoSrc(track: TrackItem): string | null {
  if (!track.selectVideoId) return null;
  const video = track.videoList?.find((v) => v.id === track.selectVideoId);
  return video?.src || null;
}

/** 截取视频首帧封面 */
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
      video.currentTime = 0;
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

function changeIndex(index: number) {
  if (activeTrackIndex.value == index) return;
  const prevIndex = activeTrackIndex.value;
  activeTrackIndex.value = index;
  emit("change", prevIndex);
}
/** 删除轨道请求 */
async function deleteTrack(index: number) {
  const track = trackList.value[index];
  if (!track) return;
  await axios.post("/production/workbench/deleteTrack", { id: track.id }, { silent: true });
  checkedTrackIds.value = checkedTrackIds.value.filter((id) => id !== track.id);
  // 删除该轨道的图片缓存
  const pid = project.value?.id;
  const sid = episodesId.value;
  if (pid != null && sid != null && track.id != null) {
    removeCache(pid, sid, track.id);
  }
  // 轨道列表由父组件 getGenerateData 重拉，索引修正统一在重拉完成后进行（见 generate/index.vue）
}
function confirmDeleteTrack(index: number) {
  const dialog = DialogPlugin.confirm({
    header: $t("workbench.generate.del"),
    body: $t("workbench.generate.delConfirm"),
    confirmBtn: $t("settings.generate.delConfirmBtn"),
    cancelBtn: $t("settings.memory.msg.cancel"),
    onConfirm: async () => {
      try {
        await deleteTrack(index);
        window.$message.success($t("workbench.generate.delSuccess"));
        emit("getData");
      } catch (e: any) {
        window.$message.error(e.message ?? $t("workbench.cornerScape.cancelGeneration") + "失败");
      } finally {
        dialog.destroy();
      }
    },
  });
}
async function addTrack() {
  const { data: modelData } = await axios.post("/modelSelect/getModelDetail", { modelId: props.modelParmas.model });
  const drMap = modelData.durationResolutionMap;
  if (!Array.isArray(drMap) || drMap.length === 0 || !drMap[0].duration?.length) return;
  const duration = drMap[0].duration[0];
  const { data } = await axios.post("/production/workbench/addTrack", {
    projectId: project.value?.id,
    scriptId: episodesId.value ?? 0,
    duration,
  });
  // await getGenerateData();
  emit("getData");
  activeTrackIndex.value = trackList.value.length - 1;
}
/** 获取 URL 中的文件扩展名 */
function getFileExtension(url: string): string {
  const ext = url.split(".").pop()?.split(/[#?]/)[0];
  return ext || "mp4";
}
/** 批量下载已勾选轨道的选中视频，打包为 zip */
async function batchDownloadVideo(): Promise<void> {
  if (!checkedTrackIds.value.length) {
    window.$message.warning($t("workbench.generate.selectTrackFirst"));
    return;
  }
  const zip = new JSZip();
  const selectedTracks = trackList.value.filter((track) => checkedTrackIds.value.includes(track.id));
  const tasks = selectedTracks
    .map((track) => {
      const video = track.videoList.find((v) => v.id === track.selectVideoId);
      if (!video?.src) return null;
      const filename = `分镜${track.id}.${getFileExtension(video.src)}`;
      return fetch(video.src)
        .then((res) => res.blob())
        .then((blob) => zip.file(filename, blob))
        .catch((err) => console.error(`视频下载失败: ${video.src}`, err));
    })
    .filter(Boolean);
  await Promise.all(tasks);
  const zipBlob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `视频批量下载_${Date.now()}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  checkedTrackIds.value = [];
  checkAll.value = false;
}

/** 批量删除所有轨道中生成失败的视频 */
async function batchDeleteFailedVideos() {
  const failedVideos: { trackId: number; videoId: number }[] = [];
  trackList.value.forEach((track) => {
    track.videoList.forEach((v) => {
      if (v.state === "生成失败" && v.id != null) {
        failedVideos.push({ trackId: track.id, videoId: v.id });
      }
    });
  });

  if (!failedVideos.length) {
    window.$message.info($t("workbench.generate.noFailedVideos"));
    return;
  }

  const dlg = DialogPlugin.confirm({
    header: $t("workbench.generate.batchDeleteFailedVideos"),
    body: $t("workbench.generate.batchDeleteFailedVideosConfirm", { count: failedVideos.length }),
    confirmBtn: $t("settings.generate.delConfirmBtn"),
    cancelBtn: $t("settings.memory.msg.cancel"),
    onConfirm: async () => {
      dlg.destroy();
      try {
        await Promise.all(
          failedVideos.map((v) => axios.post("/production/workbench/delVideo", { id: v.videoId })),
        );
        failedVideos.forEach((v) => {
          const track = trackList.value.find((t) => t.id === v.trackId);
          if (track) {
            track.videoList = track.videoList.filter((video) => video.id !== v.videoId);
          }
        });
        window.$message.success($t("workbench.generate.batchDeleteFailedVideosSuccess", { count: failedVideos.length }));
      } catch (e) {
        window.$message.error((e as Error)?.message ?? "删除失败");
      }
    },
    onCancel: () => dlg.destroy(),
  });
}

const generateTextLoad = ref(false);
const extraPromptRef = ref("");

function batchGenText() {
  if (!checkedTrackIds.value.length) {
    window.$message.warning($t("workbench.generate.selectTrackFirst"));
    return;
  }
  extraPromptRef.value = "";
  const dlg = DialogPlugin.confirm({
    header: $t("workbench.generate.batchGenerateText"),
    body: () =>
      h("div", { style: "padding: 8px 0" }, [
        h("div", { style: "margin-bottom: 8px; font-size: 14px; color: var(--td-text-color-secondary);" }, $t("workbench.generate.extraPromptHint")),
        h("textarea", {
          value: extraPromptRef.value,
          rows: 5,
          placeholder: $t("workbench.generate.extraPromptPlaceholder"),
          style: "width: 100%; resize: vertical; border: 1px solid var(--td-border-level-2-color); border-radius: 6px; padding: 8px 12px; font-size: 14px; line-height: 1.5; outline: none; background: var(--td-bg-color-container); color: var(--td-text-color-primary); overflow-y: auto;",
          onInput: (e: Event) => {
            extraPromptRef.value = (e.target as HTMLTextAreaElement).value;
          },
        }),
      ]),
    confirmBtn: $t("workbench.generate.generateText"),
    cancelBtn: $t("settings.memory.msg.cancel"),
    onConfirm: async () => {
      dlg.destroy();
      doBatchGenText(extraPromptRef.value);
    },
    onCancel: () => dlg.destroy(),
  });
}

function doBatchGenText(extraPrompt: string) {
  generateTextLoad.value = true;
  const mode = props.modelParmas.mode;
  const minRef = mode === "startEndRequired" ? 2 : mode === "text" ? 0 : 1;
  if (minRef > 0) {
    // 参考模式缺少参考素材时直接提示，避免 AI 回复无意义内容
    const lacking = trackList.value.filter((track) => {
      if (!checkedTrackIds.value.includes(track.id)) return false;
      const info = getTrackUploadInfo(track);
      return info.filter((i) => typeof i.id === "number" && !isNaN(i.id)).length < minRef;
    });
    if (lacking.length) {
      generateTextLoad.value = false;
      window.$message.warning(mode === "startEndRequired" ? $t("workbench.generate.refRequiredStartEnd") : $t("workbench.generate.refRequired"));
      return;
    }
  }
  const trackData: any[] = [];
  trackList.value.forEach((track, index) => {
    if (!checkedTrackIds.value.includes(track.id)) return;
    const trackId = track.id;
    let info = [];
    if (props.modelParmas.mode == "text") {
      info = track?.medias.map(({ id, sources }) => ({ id, sources }));
    } else {
      info = getTrackUploadInfo(track);
    }
    trackData.push({
      trackId,
      info: info.filter((i) => typeof i.id === "number" && !isNaN(i.id)),
    });
    track.state = "生成中";
  });
  // 记录本次参与批量生成的轨道，失败时只标记这些轨道
  const batchTrackIds = new Set(trackData.map((t) => t.trackId));
  axios
    .post("/production/workbench/batchGeneratePrompt", {
      projectId: project.value?.id,
      trackData,
      model: props.modelParmas.model,
      mode: props.modelParmas.mode,
      language: props.modelParmas.language === "system" ? cachedLocale.value : props.modelParmas.language,
      extraPrompt,
      concurrentCount: otherSetting.value.assetsBatchGenereateSize,
    })
    .then(({ data }) => {
      window.$message.success("开始生成提示词");
      generateTextLoad.value = false;
      checkedTrackIds.value = [];
      checkAll.value = false;
    })
    .catch((e) => {
      window.$message.error(e?.message ?? "生成提示词失败");
      trackList.value.forEach((i) => {
        if (batchTrackIds.has(i.id)) i.state = "生成失败";
      });
    })
    .finally(() => {});
}
/**
 * 获取指定轨道的上传数据：
 * 当前活动轨道 → uploadBox（含未保存的最新编辑）
 * 其他轨道 → uploadBoxCache（含切换前的编辑）→ 降级 track.medias
 * @param filterEmpty 是否过滤掉没有 src 的项（生成视频时需要过滤，生成提示词时不需要）
 */
function getTrackUploadInfo(track: TrackItem, filterEmpty = false) {
  const activeTrackId = trackList.value[activeTrackIndex.value]?.id;

  if (track.id === activeTrackId) {
    const items = props.imageList as UploadItem[];
    return (filterEmpty ? items.filter((item) => Boolean(item.src)) : items).map(({ id, sources }) => ({
      id,
      sources: (sources ?? "storyboard") as string,
    }));
  }
  return track.medias.filter((m) => !filterEmpty || Boolean(m.src)).map(({ id, sources }) => ({ id, sources: (sources ?? "storyboard") as string }));
}
const generateVideoLoad = ref(false);
/** 批量为已勾选轨道生成视频 */
function batchGenVideo() {
  if (!checkedTrackIds.value.length) {
    window.$message.warning($t("workbench.generate.selectTrackFirst"));
    return;
  }
  const dlg = DialogPlugin.confirm({
    header: $t("workbench.generate.generateConfirm"),
    body: $t("workbench.generate.generateVideosInBatches"),
    onConfirm: async () => {
      dlg.destroy();

      const checkedTrackData = trackList.value.filter((track) => checkedTrackIds.value.includes(track.id));
      const notHasPrompt = checkedTrackData.filter((i) => !i.prompt);
      if (notHasPrompt.length) return window.$message.warning($t("workbench.generate.skipDataWithEmptyVideoPromptWords"));

      // 参考模式缺少参考素材时直接提示，避免任务静默失败
      const mode = props.modelParmas.mode;
      const minRef = mode === "startEndRequired" ? 2 : mode === "text" ? 0 : 1;
      if (minRef > 0) {
        const lacking = checkedTrackData.filter(
          (track) => getTrackUploadInfo(track, true).filter((i) => typeof i.id === "number" && !isNaN(i.id)).length < minRef,
        );
        if (lacking.length) {
          return window.$message.warning(mode === "startEndRequired" ? $t("workbench.generate.refRequiredStartEnd") : $t("workbench.generate.refRequired"));
        }
      }

      const trackData = checkedTrackData.map((track) => {
        const trackId = track.id;
        const uploadData = props.modelParmas.mode === "text" ? [] : getTrackUploadInfo(track, true);
        return {
          duration: props.autoSelectDuration(track.duration || props.modelParmas.duration),
          prompt: track.prompt,
          uploadData,
          trackId,
        };
      });
      const requestData = {
        projectId: project.value?.id,
        scriptId: episodesId.value,
        model: props.modelParmas.model,
        mode: props.modelParmas.mode,
        resolution: props.modelParmas.resolution,
        audio: Boolean(props.modelParmas.audio),
        trackData,
      };
      try {
        const { data } = await axios.post("/production/workbench/batchGenerateVideo", requestData);
        const videoRecordId: Record<number, number> = {};
        data.forEach((item: { videoId: number; trackId: number }) => {
          videoRecordId[item.trackId] = item.videoId;
        });
        checkedTrackData.forEach((i) => {
          if (videoRecordId[i.id])
            i.videoList.push({
              id: videoRecordId[i.id],
              state: "生成中",
              src: "",
            });
        });
        checkedTrackIds.value = [];
        window.$message.success($t("workbench.generate.generateStarted"));
      } catch (e) {
        window.$message.error((e as any)?.message ?? $t("workbench.generate.generateError"));
      } finally {
        generateVideoLoad.value = false;
      }
    },
    onCancel: () => dlg.destroy(),
  });
}

/** 全选 / 取消全选轨道 */
function handleCheckAll(val: boolean) {
  const allIds = trackList.value.map((t) => t.id).filter((id): id is number => id != null);
  checkedTrackIds.value = val ? allIds : [];
}

/** 快捷选择选项 */
const quickSelectOptions = computed(() => [
  { content: $t("workbench.generate.selectUnsuccessful"), value: "unsuccessful" },
  { content: $t("workbench.generate.selectNoPrompt"), value: "noPrompt" },
  { content: $t("workbench.generate.selectFailed"), value: "failed" },
  { content: $t("workbench.generate.invertSelect"), value: "invert" },
]);

/** 快捷选择处理 */
function handleQuickSelect(data: any) {
  const value = String(data?.value ?? "");
  const allIds = trackList.value.map((t) => t.id).filter((id): id is number => id != null);

  switch (value) {
    case "unsuccessful":
      checkedTrackIds.value = allIds.filter((id) => {
        const track = trackList.value.find((t) => t.id === id);
        return track && !track.videoList.some((v) => v.src);
      });
      break;
    case "noPrompt":
      checkedTrackIds.value = allIds.filter((id) => {
        const track = trackList.value.find((t) => t.id === id);
        return track && !track.prompt;
      });
      break;
    case "failed":
      checkedTrackIds.value = allIds.filter((id) => {
        const track = trackList.value.find((t) => t.id === id);
        return track && track.videoList.some((v) => v.state === "生成失败");
      });
      break;
    case "invert":
      checkedTrackIds.value = allIds.filter((id) => !checkedTrackIds.value.includes(id));
      break;
  }

  checkAll.value = allIds.length > 0 && allIds.every((id) => checkedTrackIds.value.includes(id));
}

/** 单个勾选轨道 */
function toggleCheck(trackId: number | undefined, val: boolean) {
  if (trackId == null) return;
  if (val) {
    if (!checkedTrackIds.value.includes(trackId)) checkedTrackIds.value.push(trackId);
  } else {
    checkedTrackIds.value = checkedTrackIds.value.filter((id) => id !== trackId);
  }
  const allIds = trackList.value.map((t) => t.id).filter((id): id is number => id != null);
  checkAll.value = allIds.length > 0 && allIds.every((id) => checkedTrackIds.value.includes(id));
}

// 轨道列表变化时，截取选中视频首帧（只监听 selectVideoId 和 videoList 变化，避免深度监听整个 trackList）
watch(
  () => trackList.value.map((t) => ({ selectVideoId: t.selectVideoId, videoList: t.videoList })),
  () => {
    trackList.value.forEach((track) => {
      const src = getSelectedVideoSrc(track);
      if (src) captureVideoCover(src);
    });
  },
  { deep: true, immediate: true },
);
</script>

<style lang="scss" scoped>
.videoTrack {
  width: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  .trackMenu {
    margin-bottom: 10px;
    .selectedCount {
      font-size: 12px;
      color: var(--td-text-color-secondary);
      margin-left: 8px;
    }
    .quickSelectBtn {
      padding: 0 4px;
    }
    .right {
      gap: 8px;
    }
  }
  .itemBox {
    height: 150px;
    flex: 1;
    min-height: 0;
    width: 100%;
    display: flex;
    overflow-x: auto;
    gap: 10px;
    padding-bottom: 6px;
    &::-webkit-scrollbar {
      height: 6px;
    }
    &::-webkit-scrollbar-thumb {
      background: #696969;
      border-radius: 3px;
    }
    .item {
      border-radius: 8px;
      flex-shrink: 0;
      width: 200px;
      border: 1px solid var(--td-gray-color-3);
      overflow: hidden;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      &.active {
        border-color: var(--td-brand-color);
        border-width: 2px;
        box-shadow: 0 0 0 3px rgba(var(--td-brand-color-rgb, 0, 82, 217), 0.25);
        background: linear-gradient(180deg, rgba(var(--td-brand-color-rgb, 0, 82, 217), 0.05) 0%, transparent 100%);
      }
      &:hover {
        filter: brightness(90%);
      }
      .indexTag {
        position: absolute;
        bottom: 4px;
        left: 4px;
        z-index: 2;
      }
      .selectTag {
        position: absolute;
        bottom: 4px;
        right: 4px;
        z-index: 1;
      }
      .thumbGroup {
        width: 100%;
        height: 100%;
        display: flex;
        .thumb {
          flex: 1;
          min-width: 0;
          height: 100%;
          object-fit: cover;
        }
        .placeholder {
          background: var(--td-bg-color-secondarycontainer);
          color: var(--td-text-color-placeholder);
          font-size: 12px;
        }
      }
      .emptyTrack {
        color: var(--td-text-color-placeholder);
        font-size: 12px;
      }
      .trackCheck {
        position: absolute;
        top: 4px;
        left: 4px;
        z-index: 2;
      }
      .deleteBtn {
        position: absolute;
        top: 4px;
        right: 4px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.5);
        color: #fff;
        display: none;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 1;
        &:hover {
          background: rgba(0, 0, 0, 0.8);
        }
      }
      &:hover .deleteBtn {
        display: flex;
      }
    }
    .addItem {
      border: 4px dashed var(--td-component-border);
      cursor: pointer;
    }
    .selectedVideoThumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
      pointer-events: none;
      user-select: none;
      display: block;
    }
  }
}
</style>
