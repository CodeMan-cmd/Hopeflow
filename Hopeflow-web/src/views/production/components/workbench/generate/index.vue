<template>
  <div class="index fc">
    <div class="referenceImage">
      <div class="uploadBtn">
        <imageSelect :mode="modelParmas.mode as VideoMode" v-model="imageList" :storyboard-list="storyboardList" />
      </div>
    </div>
    <div class="modelSelect">
      <modeMenu v-model="modelParmas" :modeOptions="modeOptions" :trackId="currentTrack?.id" :modeList="modeList" @modeChange="modeChange" />
    </div>
    <div class="generate ac">
      <div class="prompt" v-if="currentTrack">
        <t-card :title="'#' + (activeTrackIndex + 1) + $t('workbench.generate.generateText')" header-bordered class="videoPrompt">
          <template #actions>
            <t-button size="small" class="genTextbtn" :loading="currentTrack.state == '生成中'" @click="genText">
              {{ $t("workbench.generate.generateText") }}
            </t-button>
          </template>
          <div class="promptData fc">
            <div class="promptInput" @focusout="handlePromptBlur">
              <promptEditor v-model="currentTrack.prompt" :references="references" :placeholder="$t('workbench.generate.promptPlaceholder')" />
            </div>
          </div>
        </t-card>
      </div>
      <div class="video">
      <videoCard
        v-if="currentTrack"
        :active-track-index="activeTrackIndex"
        v-model:current-track="currentTrack"
        :generating="generatingVideo"
        @refresh="getGenerateData"
        @generate="generateVideo" />
    </div>
    </div>
    <div class="track">
      <newTrack
        v-if="viewMode === 'list'"
        v-model:activeTrackIndex="activeTrackIndex"
        v-model="trackList"
        :image-list="imageList"
        @change="trackChange"
        :modelParmas="modelParmas"
        :clampDuration="clampDuration"
        :autoSelectDuration="autoSelectDuration"
        :batchAutoMatchDuration="batchAutoMatchDuration"
        @getData="getGenerateData"
        @viewModeChange="viewMode = $event" />
      <canvasView
        v-else
        :track-list="trackList"
        :active-index="activeTrackIndex"
        :duration-max="durationMax"
        :chain-running="chainRunning"
        @select="handleCanvasSelect"
        @update-duration="handleUpdateDuration"
        @generate-node="generateVideoAt"
        @generate-chain="generateChainVideo"
        @back-to-list="viewMode = 'list'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Ref } from "vue";
import newTrack from "./components/track.vue";
import canvasView from "./components/canvasView.vue";
import imageSelect from "./components/imageSelect.vue";
import modeMenu from "./components/modeMenu.vue";
import videoCard from "./components/video.vue";
import "@/views/production/components/workbench/type/type";
import axios from "@/utils/axios";
import projectStore from "@/stores/project";
import promptEditor from "@/components/promptEditor.vue";
import imageListCacheStore from "@/stores/imageListCache";
import { cachedLocale } from "@/locales";

const { project } = storeToRefs(projectStore());
const episodesId = inject<Ref<number>>("episodesId")!;
const activeTrackIndex = ref(0);
/** 分镜台视图模式：list 列表视图 / canvas 画布视图 */
const viewMode = ref<"list" | "canvas">("list");
const cacheStore = imageListCacheStore();
const { getCache, setCache, removeCache, initCacheFromTrackList, warmUpUrls } = cacheStore;
const { urlMap } = storeToRefs(cacheStore);

const modeOptions = ref<VideoModel>({
  name: "",
  modelName: "",
  durationResolutionMap: [],
  audio: false,
  type: "video",
  mode: [],
}); // 当前模型配置

const trackList = ref<TrackItem[]>([]); // 轨道列表
const generatingVideo = ref(false); // 视频生成请求进行中（驱动生成按钮 loading）
const chainRunning = ref(false); // 画布串联生成进行中（驱动串联按钮 loading）

const modelParmas = ref<ModelSetting>({
  mode: "",
  model: "",
  resolution: "480p",
  duration: 8,
  audio: false,
  language: "system",
});

const storyboardList = ref<StoryboardItem[]>([]); // 分镜列表

/** 是否为首尾帧模式（数组下标决定槽位，不可排序） */
const isFrameMode = computed(() => {
  return ["startEndRequired", "endFrameOptional", "startFrameOptional"].includes(modelParmas.value.mode);
});

/** 当前模式所需的最少参考素材数量（text 模式返回 0，表示不要求参考素材） */
function minRefCount(): number {
  const mode = modelParmas.value.mode;
  if (mode === "text") return 0;
  if (mode === "startEndRequired") return 2;
  return 1; // singleImage / endFrameOptional / startFrameOptional / 多参考模式
}
/** 参考素材缺失时的提示文案（首尾帧模式有专属文案） */
function refRequiredMsg(): string {
  return modelParmas.value.mode === "startEndRequired"
    ? $t("workbench.generate.refRequiredStartEnd")
    : $t("workbench.generate.refRequired");
}

const imageList = computed({
  get(): UploadItem[] {
    // 触发对 urlMap 的依赖追踪，当 warmUpUrls 更新 urlMap 后自动重新计算
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    urlMap.value;
    const trackId = currentTrack.value?.id;
    const pid = project.value?.id;
    const sid = episodesId.value;
    // 首尾帧模式下保持原始顺序（index 0=首帧, 1=尾帧），只保留两个槽位
    if (isFrameMode.value) {
      if (pid != null && sid != null && trackId != null) {
        const cached = getCache(pid, sid, trackId);
        if (cached?.length) return [...cached].slice(0, 2);
      }
      const medias = currentTrack.value?.medias;
      return medias?.length ? [...(medias as UploadItem[])].slice(0, 2) : [];
    }
    // 优先从缓存读取
    if (pid != null && sid != null && trackId != null) {
      const cached = getCache(pid, sid, trackId);

      if (cached?.length) {
        return [...cached];
      }
    }
    const medias = currentTrack.value?.medias;
    if (!medias?.length) return [];
    return [...(medias as UploadItem[])];
  },
  set(val: UploadItem[]) {
    if (currentTrack.value) {
      currentTrack.value.medias = val as any;
      // 同步写入缓存
      const pid = project.value?.id;
      const sid = episodesId.value;
      const trackId = currentTrack.value.id;
      if (pid != null && sid != null && trackId != null) {
        setCache(pid, sid, trackId, val);
      }
    }
  },
});

function modeChange(newVal: string) {
  if (newVal == modelParmas.value.mode) return;
  if ((imageList.value.length || currentTrack.value?.prompt) && modelParmas.value.mode) {
    const dialog = DialogPlugin.confirm({
      header: $t("workbench.generate.modeChange"),
      body: $t("workbench.generate.modeChangeConfirm"),
      confirmBtn: $t("settings.generate.modelChnageSure"),
      cancelBtn: $t("settings.memory.msg.cancel"),
      onConfirm: async () => {
        imageList.value = [];
        currentTrack.value.prompt = "";
        dialog.destroy();
        modelParmas.value.mode = newVal;
      },
    });
  } else if (newVal) {
    modelParmas.value.mode = newVal;
  }
}
const modeList = computed(() => {
  const modeLabelMap: Record<string, string> = {
    singleImage: "单图",
    startEndRequired: "首尾帧",
    endFrameOptional: "尾帧可选",
    startFrameOptional: "首帧可选",
    text: "文本生视频",
    videoReference: "视频",
    imageReference: "图片",
    audioReference: "音频",
    textReference: "文本",
  };
  function parseRefLabel(m: string): string {
    const match = m.match(/^(videoReference|imageReference|audioReference|textReference):(\d+)$/);
    if (match) {
      const base = modeLabelMap[match[1]] || match[1];
      return `${base} ×${match[2]}`;
    }
    return modeLabelMap[m] || m;
  }
  return modeOptions.value.mode
    ? modeOptions.value.mode.map((mode) =>
        Array.isArray(mode)
          ? { value: JSON.stringify(mode), label: mode.map((m) => parseRefLabel(m)).join(" + ") + "参考" }
          : { value: mode, label: modeLabelMap[mode] || mode },
      )
    : [];
});
const currentTrack = computed({
  get() {
    return trackList.value[activeTrackIndex.value];
  },
  set(val) {
    trackList.value[activeTrackIndex.value] = val;
  },
});

/** 将时长限制在模型支持的范围内 */
function clampDuration(trackDuration: number): number {
  const drMap = modeOptions.value?.durationResolutionMap;
  if (Array.isArray(drMap) && drMap.length > 0 && drMap[0].duration?.length) {
    const durations = drMap[0].duration;
    return Math.max(Math.min(...durations), Math.min(trackDuration, Math.max(...durations)));
  }
  return trackDuration;
}

/** 模型支持的时长上限（供画布手动模式参数 Widget 使用） */
const durationMax = computed(() => {
  const drMap = modeOptions.value?.durationResolutionMap;
  if (Array.isArray(drMap) && drMap.length > 0 && drMap[0].duration?.length) {
    return Math.max(...drMap[0].duration);
  }
  return 30;
});

/** 画布手动模式修改时长：同步后端与本地 */
async function handleUpdateDuration(index: number, duration: number) {
  const track = trackList.value[index];
  if (!track?.id) return;
  const clamped = clampDuration(duration);
  try {
    await axios.post("/production/workbench/updateVideoDuration", { id: track.id, duration: clamped });
    track.duration = clamped;
    window.$message.success($t("workbench.generate.updatedDuration", { duration: clamped }));
  } catch (e) {
    window.$message.error((e as Error)?.message ?? "时长更新失败");
  }
}

/** 自动选择模型支持的最接近 trackDuration 的时长 */
function autoSelectDuration(trackDuration: number): number {
  const drMap = modeOptions.value?.durationResolutionMap;
  if (Array.isArray(drMap) && drMap.length > 0 && drMap[0].duration?.length) {
    const durations = drMap[0].duration;
    return durations.reduce((closest, d) =>
      Math.abs(d - trackDuration) < Math.abs(closest - trackDuration) ? d : closest
    );
  }
  return trackDuration;
}

/** 批量自动匹配所有轨道的时长 */
async function batchAutoMatchDuration() {
  const updates = trackList.value
    .filter((t) => t.id != null)
    .map((t) => ({ id: t.id!, duration: autoSelectDuration(t.duration || modelParmas.value.duration) }));

  await Promise.all(
    updates.map((u) =>
      axios.post("/production/workbench/updateVideoDuration", { id: u.id, duration: u.duration }),
    ),
  );

  updates.forEach((u) => {
    const track = trackList.value.find((t) => t.id === u.id);
    if (track) track.duration = u.duration;
  });

  modelParmas.value.duration = autoSelectDuration(
    trackList.value[activeTrackIndex.value]?.duration || modelParmas.value.duration,
  );
  window.$message.success($t("workbench.generate.autoMatchDurationSuccess", { count: updates.length }));
}
watch(
  () => modelParmas.value.model,
  (val) => {
    if (!val) {
      modeOptions.value = {
        name: "",
        modelName: "",
        durationResolutionMap: [],
        audio: false,
        type: "video",
        mode: [],
      };
      modelParmas.value.mode = "";
      return;
    }
    axios.post("/modelSelect/getModelDetail", { modelId: val }).then(({ data }) => {
      modeOptions.value = data;
      modelParmas.value.audio = data.audio === true || data.audio === "true" || data.audio == "optional";
      const drMap = data.durationResolutionMap;
      if (Array.isArray(drMap) && drMap.length > 0) {
        if (drMap[0].resolution?.length) modelParmas.value.resolution = drMap[0].resolution[0];
        if (drMap[0].duration?.length) modelParmas.value.duration = autoSelectDuration(modelParmas.value.duration);
      }

      const currentParsed = parseMode(modelParmas.value.mode);
      const modeMatched =
        currentParsed !== null &&
        data.mode.some((m: VideoMode) => {
          if (Array.isArray(m) && Array.isArray(currentParsed)) {
            return JSON.stringify(m) === JSON.stringify(currentParsed);
          }
          return m == currentParsed;
        });
      if (!modeMatched) {
        const newMode = Array.isArray(data.mode[0]) ? JSON.stringify(data.mode[0]) : data.mode[0];
        modeChange(newMode);
      }
    });
  },
);
function parseMode(value: string): VideoMode | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed as ReferenceType[];
  } catch {
    return value as Exclude<VideoMode, ReferenceType[]>;
  }
  return value as Exclude<VideoMode, ReferenceType[]>;
}
/** uploadBox 作为 promptEditor 的引用预览 */
const references = computed(() => {
  function getFileTypeByExt(src: string | undefined): "image" | "video" | "audio" {
    if (!src) return "image";
    // 去掉 query 和 hash 部分
    const cleanSrc = src.split("?")[0].split("#")[0];
    const ext = cleanSrc.split(".").pop()?.toLowerCase() ?? "";

    if (["mp4", "webm", "mov", "avi", "mkv"].includes(ext)) return "video";
    if (["mp3", "wav", "ogg", "aac", "flac", "m4a"].includes(ext)) return "audio";
    return "image";
  }

  return imageList.value
    .filter((item) => item.src)
    .map((item) => ({
      type: getFileTypeByExt(item.src) as "image" | "video" | "audio" | "text",
      src: item.src ?? "",
    }));
});

async function getGenerateData() {
  const { data } = await axios.post("/production/workbench/getGenerateData", {
    projectId: project.value?.id,
    scriptId: episodesId.value ?? 0,
  });

  storyboardList.value = data.storyboardList;
  // 优先使用本地缓存，没有缓存则用后端数据并写入缓存
  const pid = project.value?.id;
  const sid = episodesId.value;
  if (pid != null && sid != null) {
    // 先将没有缓存的轨道写入缓存（保留已有本地编辑）
    initCacheFromTrackList(pid, sid, data.trackList);
    // 批量向后端请求文件路径对应的完整 URL
    await warmUpUrls(pid, sid);
    // 将本地缓存回写到 trackList，确保优先使用缓存数据（src 已解析为完整 URL）
    data.trackList.forEach((track: TrackItem) => {
      if (track.id == null) return;
      const cached = getCache(pid, sid, track.id);
      if (cached?.length) {
        track.medias = cached as unknown as TrackMedia[];
      }
    });
    // 整体赋值触发响应式
    trackList.value = [...data.trackList];
    // 删除轨道等操作导致轨道数减少时，统一修正当前轨道索引，避免越界
    if (activeTrackIndex.value >= trackList.value.length) {
      activeTrackIndex.value = Math.max(trackList.value.length - 1, 0);
    }
  }

  modelParmas.value.duration = autoSelectDuration(data.trackList?.[activeTrackIndex.value]?.duration ?? 8);
}
/** 提示词失焦时保存到后端 */
function handlePromptBlur() {
  const trackId = trackList.value[activeTrackIndex.value]?.id;
  if (trackId == null) return;
  axios.post("/production/workbench/updateVideoPrompt", { id: trackId, prompt: currentTrack.value?.prompt });
}

/** 单个轨道生成提示词 */
async function genText() {
  const track = currentTrack.value;
  if (track.id == null || track.state === "生成中") return;
  let info: { id: number; sources: string }[] = [];
  const currentTrackId = track.id;
  const rawMedias = (track.medias ?? []) as UploadItem[];
  if (modelParmas.value.mode == "text") {
    info = rawMedias.filter((item) => typeof item.id === "number" && !isNaN(item.id)).map(({ id, sources }) => ({ id: id!, sources }));
  } else {
    const frameMode = ["startEndRequired", "endFrameOptional", "startFrameOptional"];
    const preSliced = frameMode.includes(modelParmas.value.mode)
      ? rawMedias.slice(0, 2)
      : modelParmas.value.mode === "singleImage"
        ? rawMedias.slice(0, 1)
        : rawMedias;
    const filtered = preSliced.filter((item) => typeof item.id === "number" && !isNaN(item.id)).map(({ id, sources }) => ({ id: id!, sources }));
    if (frameMode.includes(modelParmas.value.mode)) info = filtered.slice(0, 2);
    else if (modelParmas.value.mode === "singleImage") info = filtered.slice(0, 1);
    else info = filtered;
  }
  // 参考模式缺少参考素材时直接提示，避免 AI 回复"请提供资产信息与分镜信息"等无意义内容
  if (minRefCount() > 0 && info.length < minRefCount()) {
    window.$message.warning(refRequiredMsg());
    return;
  }
  track.state = "生成中";
  try {
    const { data } = await axios.post("/production/workbench/generateVideoPrompt", {
      projectId: project.value?.id,
      trackId: currentTrackId,
      info: info,
      model: modelParmas.value.model,
      mode: modelParmas.value.mode,
      language: modelParmas.value.language === "system" ? cachedLocale.value : modelParmas.value.language,
    });
    track.prompt = data;
    track.state = "已完成";
  } catch (e) {
    track.state = "生成失败";
    window.$message.error((e as Error)?.message ?? "提示词生成失败");
  }
}
function trackChange(prevIndex?: number) {
  // 切换前：将旧轨道的 imageList 保存到缓存
  if (prevIndex != null) {
    const prevTrack = trackList.value[prevIndex];
    const pid = project.value?.id;
    const sid = episodesId.value;
    if (pid != null && sid != null && prevTrack?.id != null) {
      setCache(pid, sid, prevTrack.id, prevTrack.medias as unknown as UploadItem[]);
    }
  }
  // 切换后：从缓存恢复当前轨道的 imageList
  const pid = project.value?.id;
  const sid = episodesId.value;
  const curTrack = trackList.value[activeTrackIndex.value];
  if (pid != null && sid != null && curTrack?.id != null) {
    const cached = getCache(pid, sid, curTrack.id);
    if (cached) {
      curTrack.medias = cached as unknown as TrackMedia[];
    }
  }
  // imageList 是基于 currentTrack.medias 的计算属性，切换轨道后自动切换数据
  if (modelParmas.value.mode == "singleImage" && imageList.value.length > 1) {
    imageList.value = imageList.value.slice(0, 1);
  }
  modelParmas.value.duration = autoSelectDuration(trackList.value?.[activeTrackIndex.value]?.duration ?? 8);
}
/** 画布视图点击节点：选中对应轨道并联动缓存（与列表视图 trackChange 保持一致） */
function handleCanvasSelect(index: number) {
  if (index === activeTrackIndex.value) return;
  const prevIndex = activeTrackIndex.value;
  activeTrackIndex.value = index;
  trackChange(prevIndex);
}
/** 监听当前轨道的 medias 变化，实时同步到缓存 */
watch(
  () => currentTrack.value?.medias,
  (medias) => {
    if (!medias) return;
    const pid = project.value?.id;
    const sid = episodesId.value;
    const trackId = currentTrack.value?.id;
    if (pid != null && sid != null && trackId != null) {
      setCache(pid, sid, trackId, medias as unknown as UploadItem[]);
    }
  },
  { deep: true },
);

onMounted(() => {
  modelParmas.value.model = project.value?.videoModel || "";
  modelParmas.value.mode = project.value?.mode || "";
  getGenerateData();
  if (hasGenerateVideoIds.value && hasGenerateVideoIds.value.length) {
    startPoll();
  }
});
/** 组装生成视频的 uploadData：当前轨道 medias 有效项 + 附加上游连线资源 */
function buildUploadData(track: TrackItem, extraUpload: { id: number; sources: string }[] = []): { id: number; sources: string }[] {
  if (modelParmas.value.mode === "text") return extraUpload;
  const frameMode = ["startEndRequired", "endFrameOptional", "startFrameOptional"];
  const rawMedias = (track.medias ?? []) as UploadItem[];
  const preSliced = frameMode.includes(modelParmas.value.mode)
    ? rawMedias.slice(0, 2)
    : modelParmas.value.mode === "singleImage"
      ? rawMedias.slice(0, 1)
      : rawMedias;
  const filtered = preSliced
    .filter((item) => Boolean(item.src) && typeof item.id === "number" && !isNaN(item.id))
    .map(({ id, sources }) => ({ id: id!, sources }));
  let own: { id: number; sources: string }[];
  if (frameMode.includes(modelParmas.value.mode)) own = filtered.slice(0, 2);
  else if (modelParmas.value.mode === "singleImage") own = filtered.slice(0, 1);
  else own = filtered;
  // 合并上游连线传入的资源（去重）
  const seen = new Set(own.map((i) => `${i.sources}-${i.id}`));
  const merged = [...own];
  for (const up of extraUpload) {
    const key = `${up.sources}-${up.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(up);
    }
  }
  return merged;
}

/** 单个轨道生成视频 */
async function generateVideo() {
  // 参考模式缺少参考素材时直接提示，避免任务静默失败
  if (minRefCount() > 0 && buildUploadData(currentTrack.value).length < minRefCount()) {
    window.$message.warning(refRequiredMsg());
    return;
  }
  const dlg = DialogPlugin.confirm({
    header: $t("workbench.generate.generateConfirm"),
    body: $t("workbench.generate.generateConfirmBody"),
    onConfirm: async () => {
      dlg.destroy();
      generatingVideo.value = true;
      try {
        const { data } = await axios.post("/production/workbench/generateVideo", {
          projectId: project.value?.id,
          scriptId: episodesId.value,
          uploadData: buildUploadData(currentTrack.value),
          prompt: currentTrack.value.prompt,
          model: modelParmas.value.model,
          mode: modelParmas.value.mode,
          resolution: modelParmas.value.resolution,
          duration: modelParmas.value.duration,
          audio: modelParmas.value.audio,
          trackId: currentTrack.value.id,
        });
        window.$message.success($t("workbench.generate.generateStarted"));
        currentTrack.value.videoList.push({
          id: data,
          state: "生成中",
          src: "",
        });
      } catch (e) {
        window.$message.error((e as any)?.message ?? "视频发起生成请求失败");
      } finally {
        generatingVideo.value = false;
      }
    },
    onCancel: () => dlg.destroy(),
  });
}

/** 画布驱动：为指定索引的分镜生成视频（可附加上游连线资源），并触发轮询 */
async function generateVideoAt(index: number, extraUpload: { id: number; sources: string }[] = []): Promise<boolean> {
  const track = trackList.value[index];
  if (!track?.id) return false;
  if (track.state === "生成中") {
    window.$message.warning($t("workbench.generate.trackGenerating"));
    return false;
  }
  // 参考模式缺少参考素材时直接提示，避免任务静默失败
  if (minRefCount() > 0 && buildUploadData(track, extraUpload).length < minRefCount()) {
    window.$message.warning(refRequiredMsg());
    return false;
  }
  try {
    const { data } = await axios.post("/production/workbench/generateVideo", {
      projectId: project.value?.id,
      scriptId: episodesId.value,
      uploadData: buildUploadData(track, extraUpload),
      prompt: track.prompt,
      model: modelParmas.value.model,
      mode: modelParmas.value.mode,
      resolution: modelParmas.value.resolution,
      duration: track.duration || modelParmas.value.duration,
      audio: modelParmas.value.audio,
      trackId: track.id,
    });
    track.videoList.push({ id: data, state: "生成中", src: "" });
    if (!pollTimer) startPoll();
    return true;
  } catch (e) {
    window.$message.error((e as any)?.message ?? "视频发起生成请求失败");
    return false;
  }
}

/** 串联生成：从 startIndex 沿连线顺序逐个生成（严格依赖：等待上游完成后再生成下游） */
async function generateChainVideo(indices: number[], extraByIndex: Record<number, { id: number; sources: string }[]>) {
  if (chainRunning.value) return; // 防重入
  chainRunning.value = true;
  try {
    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      handleCanvasSelect(idx);
      const ok = await generateVideoAt(idx, extraByIndex[idx] || []);
      if (!ok) {
        // 生成失败或已生成中，跳过等待，继续下一个
        continue;
      }
      // 等待当前轨道视频全部完成/失败后再生成下一个
      await waitTrackVideosDone(idx);
    }
    window.$message.success($t("workbench.generate.chainDone"));
  } finally {
    chainRunning.value = false;
  }
}

/** 等待指定索引轨道上所有视频进入终态（已完成/生成失败），默认超时 30 分钟 */
function waitTrackVideosDone(index: number, timeoutMs = 30 * 60 * 1000): Promise<void> {
  return new Promise((resolve) => {
    const trackId = trackList.value[index]?.id;
    const start = Date.now();
    const timer = setInterval(async () => {
      if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        resolve();
        return;
      }
      const track = trackList.value.find((t) => t.id === trackId);
      if (!track) {
        clearInterval(timer);
        resolve();
        return;
      }
      const pending = track.videoList.filter((v) => v.state === "生成中");
      if (pending.length === 0) {
        clearInterval(timer);
        resolve();
        return;
      }
    }, 3000);
  });
}
let pollTimer: NodeJS.Timeout | null = null;
let promptPollTimer: NodeJS.Timeout | null = null;
function startPoll() {
  if (pollTimer !== null) return;
  pollTimer = setInterval(() => getVideoList(), 3000);
}

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
const hasGenerateVideoIds = computed(() => {
  return trackList.value
    .map((track) => {
      return track.videoList.filter((i) => i.state == "生成中").map((i) => i.id);
    })
    .flatMap((i) => i);
});
const hasGeneratePromptIds = computed(() => {
  const trackIds = trackList.value.filter((t) => t.state == "生成中").map((t) => t.id);
  return trackIds;
});
/** 查询所有视频列表，并检测生成完成/失败状态 */
async function getVideoList() {
  const { data } = await axios.post("/production/workbench/checkVideoStateList", {
    projectId: project.value?.id,
    scriptId: episodesId.value ?? 0,
    videoIds: hasGenerateVideoIds.value,
  });
  if (data && data.length) {
    data.forEach((item: { id: number; state: "生成中" | "未生成" | "已完成" | "生成失败"; src?: string; errorReason?: string }) => {
      for (const track of trackList.value) {
        const findData = track.videoList.find((i) => i.id == item.id);
        if (findData) {
          findData.state = item.state;
          findData.src = item?.src ?? "";
          findData.errorReason = item?.errorReason ?? "";
          break;
        }
      }
    });
  }
}
function startPromptPoll() {
  if (promptPollTimer !== null) return;
  promptPollTimer = setInterval(() => getTrackPromptList(), 3000);
}

function stopPromptPoll() {
  if (promptPollTimer) {
    clearInterval(promptPollTimer);
    promptPollTimer = null;
  }
}
/** 查询所有视频列表，并检测生成完成/失败状态 */
async function getTrackPromptList() {
  const { data } = await axios.post("/production/workbench/checkVideoPrompt", {
    projectId: project.value?.id,
    scriptId: episodesId.value ?? 0,
    trackIds: hasGeneratePromptIds.value,
  });
  if (data && data.length) {
    data.forEach((item: { id: number; state: "生成中" | "未生成" | "已完成" | "生成失败"; prompt?: string; reason?: string }) => {
      const findData = trackList.value.find((t) => t.id == item.id);
      if (findData) {
        findData.state = item.state;
        findData.prompt = item?.prompt ?? "";
        findData.reason = item?.reason ?? "";
        if (item.state === "生成失败") {
          window.$message.error(`提示词生成失败，${item.reason ?? "未知原因"}`);
        }
      }
    });
  }
}
watch(
  () => hasGenerateVideoIds.value,
  (newVal) => {
    if (newVal && newVal.length > 0) {
      startPoll();
    } else {
      stopPoll();
    }
  },
);
watch(
  () => hasGeneratePromptIds.value,
  (newVal) => {
    if (newVal && newVal.length > 0) {
      startPromptPoll();
    } else {
      stopPromptPoll();
    }
  },
);
onUnmounted(() => {
  stopPoll();
  stopPromptPoll();
});
</script>

<style lang="scss" scoped>
.index {
  height: calc(100vh - 120px);
  gap: 16px;
  overflow-y: auto;
  .referenceImage {
  }
  .modelSelect {
  }
  .generate {
    flex: 1;
    min-height: 0;
    width: 100%;
    gap: 5px;
    .prompt {
      width: 50%;
      height: 100%;
      min-height: 0;
      .videoPrompt {
        width: 100%;
        height: 100%;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        // t-card 内部由 t-loading 包裹 body，需让包裹层参与 flex 撑满，否则高度被内容撑开后被卡片裁剪
        :deep(.t-loading__parent) {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }
        :deep(.t-card__body) {
          flex: 1;
          min-height: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .promptData {
          width: 100%;
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          .promptInput {
            flex: 1;
            min-height: 0;
            overflow-y: auto;
          }
        }
      }
    }
    .video {
      width: 50%;
      height: 100%;
      min-height: 0;
    }
  }
  .track {
    height: 220px;
    min-height: 0;
    .videoTrack {
      height: 100%;
    }
  }
}
</style>
