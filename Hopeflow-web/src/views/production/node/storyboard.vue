<template>
  <t-card class="storyboard">
    <div class="titleBar dragHandle pr">
      <div class="title">
        {{ $t("workbench.production.node.storyboard.title") }}
        <t-tag size="small" variant="light" style="margin-left: 6px">{{ storyboard.length }}</t-tag>
      </div>
      <Handle :id="props.handleIds.target" type="target" :position="Position.Left" style="left: calc(-1 * var(--td-comp-paddingLR-xl))" />
      <Handle :id="props.handleIds.source" type="source" :position="Position.Right" style="right: calc(-1 * var(--td-comp-paddingLR-xl))" />
    </div>
    <div class="content">
      <t-empty v-if="!storyboard.length" style="margin-top: 16px"></t-empty>
      <t-checkbox-group v-model="selectedIds">
        <div class="frameGrid">
          <template v-for="(item, index) in storyboard" :key="item.id">
            <div class="frameItem" @mouseenter="setHoveredFrame(index)" @mouseleave="setHoveredFrame(null)">
              <div class="addBetween addBetween--left" :class="{ expanded: hoveredIndex === index }">
                <t-button
                  theme="primary"
                  variant="outline"
                  shape="circle"
                  @click.stop="editStoryboaryImage(item, [index > 0 ? storyboard[index - 1]?.src || '' : '', item.src || ''], index - 1)">
                  <template #icon><i-plus /></template>
                </t-button>
              </div>

              <div class="frameCard">
                <div
                  class="frameImage"
                  :style="{
                    width: `${200 * gridScale}px`,
                    height: `${200 * gridScale}px`,
                  }">
                  <div class="ac frameCheckbox" :style="{ transform: `scale(${styleMaxSize})` }">
                    <t-checkbox :checked="selectedIds.includes(item.id!)" @click.stop :key="item?.id || index" :value="item.id" />
                    <t-tag class="frameTypeTag" :style="{ backgroundColor: tagColors[index % tagColors.length] }">
                      S{{ String(index + 1).padStart(2, "0") }}
                    </t-tag>
                  </div>

                  <t-image
                    v-if="item.src && (item.state == '已完成' || item.state == '生成失败')"
                    :src="item.src"
                    fit="contain"
                    class="frameImg"
                    @click="editStoryboaryImage(item, [item.src])">
                  </t-image>
                  <div
                    v-if="item.src && (item.state == '已完成' || item.state == '生成失败')"
                    class="imageToolsWrap">
                    <ImageTools :style="{ transform: `scale(${styleMaxSize})` }" :src="item.src" position="br" />
                  </div>
                  <t-tooltip v-if="item.src && item.state == '生成失败'" :content="item?.reason">
                    <div class="failBadge">生成失败</div>
                  </t-tooltip>
                  <div v-else class="generatingPlaceholder" @click="editStoryboaryImage(item, [])">
                    <t-loading v-if="item.state === '生成中'" size="small" />
                    <t-tooltip v-else-if="item.state == '生成失败'" :content="item?.reason">
                      <span style="color: #ff4d4f">生成失败</span>
                    </t-tooltip>
                    <div v-else class="textToImageCard">
                      <i-text size="22" />
                      <span>{{ $t("workbench.production.node.storyboard.textToImage") }}</span>
                    </div>
                  </div>
                  <t-tooltip theme="primary" :content="$t('workbench.production.node.storyboard.deleteNode')">
                    <div class="remove ac" :style="{ transform: `scale(${styleMaxSize})` }" @click.stop="removeFn(item.id!)">
                      <i-delete theme="outline" size="18" fill="#fff" />
                    </div>
                  </t-tooltip>
                  <t-tooltip theme="primary" :content="$t('workbench.production.node.storyboard.editNode')">
                    <div class="editNode ac" :style="{ transform: `scale(${styleMaxSize})` }" @click.stop="editInfo(item)">
                      <i-edit theme="outline" size="18" fill="#fff" />
                    </div>
                  </t-tooltip>
                  <div
                    class="frameInfo"
                    :class="{ 'is-empty': !item.prompt }"
                    :title="item.prompt || ''"
                    @click="editStoryboaryImage(item, item.src ? [item.src] : [])">
                    {{ item.prompt || $t("workbench.production.node.storyboard.noPrompt") }}
                  </div>
                </div>
              </div>
              <div class="addBetween addBetween--right" :class="{ expanded: hoveredIndex === index }">
                <t-button
                  theme="primary"
                  variant="outline"
                  shape="circle"
                  @click.stop="
                    editStoryboaryImage(item, [item.src || '', index < (storyboard?.length ?? 0) - 1 ? storyboard[index + 1]?.src || '' : ''], index)
                  ">
                  <template #icon><i-plus /></template>
                </t-button>
              </div>
            </div>
          </template>
        </div>
      </t-checkbox-group>

      <div class="scaleControl">
        <span>{{ $t("workbench.production.node.storyboard.scaleRatio") }}</span>
        <t-input-number v-model="gridScale" :min="0.1" :max="3" :step="0.1" :decimal-places="1" size="small" style="width: 120px" />
      </div>
      <!-- 失败原因看板：以前界面上只有「生成失败」四个字，真正的原因只写在库里 -->
      <t-alert v-if="failedFrames.length" theme="error" class="failPanel">
        <template #message>
          <div class="failPanelBody">
            <div class="failPanelLine">
              <span class="failPanelTitle">
                {{ $t("workbench.production.node.storyboard.failSummary", { count: failedFrames.length }) }}
              </span>
              <t-tag v-for="group in failureGroups" :key="group.type" size="small" variant="light-outline" theme="danger">
                {{ group.label }} × {{ group.count }}
              </t-tag>
            </div>
            <div class="failPanelLine failPanelActions">
              <t-button size="small" theme="danger" variant="outline" @click="retryFailedOnly">
                {{ $t("workbench.production.node.storyboard.retryFailedOnly") }}
              </t-button>
              <t-button v-if="safetyFailedFrames.length" size="small" theme="warning" variant="outline" :loading="fixing" @click="openSafetyFixDialog">
                {{ $t("workbench.production.node.storyboard.safetyFixEntry") }}
              </t-button>
              <t-tooltip :content="$t('workbench.production.node.storyboard.failHoverTip')">
                <span class="failPanelHint">{{ $t("workbench.production.node.storyboard.failHoverTip") }}</span>
              </t-tooltip>
            </div>
          </div>
        </template>
      </t-alert>

      <div class="ac" style="gap: 6px; margin-bottom: 6px; flex-wrap: wrap">
        <t-tag theme="primary" variant="light">{{ $t("workbench.production.node.storyboard.selectedCount", { count: selectedIds.length }) }}</t-tag>
        <t-button size="small" :disabled="!storyboard.length" theme="default" variant="outline" @click="selectedIds = []">
          {{ $t("workbench.production.node.storyboard.clearSelection") }}
        </t-button>
        <t-button size="small" :disabled="!storyboard.length" theme="default" variant="outline" @click="selectAll">
          {{ $t("workbench.production.node.storyboard.selectAll") }}
        </t-button>
        <t-button size="small" :disabled="!storyboard.length" theme="default" variant="outline" @click="selectFailed">
          {{ $t("workbench.production.node.storyboard.selectFailed") }}
        </t-button>
        <t-button theme="danger" size="small" :disabled="!storyboard.length || !selectedIds.length" @click="handleDeleteSelected">批量删除</t-button>
      </div>
      <div class="ac" style="gap: 10px">
        <t-button block @click="previewAll" :disabled="!storyboard.length">{{ $t("workbench.production.node.storyboard.gridPreview") }}</t-button>
        <t-button block @click="openGenerateDialog()" :disabled="!storyboard.length || !selectedIds.length" :loading="generateLoading">
          {{ $t("workbench.production.node.storyboard.generateImage") }}
        </t-button>

        <!-- <t-button block @click="batchGenerateImage" :disabled="!storyboard.length" :loading="generateLoading">
          {{ $t("workbench.production.node.storyboard.batchGenerateImage") }}
        </t-button> -->
      </div>
    </div>
    <editImage v-model="visible" v-if="visible" :flowData="currentRow" type="storyboard" @save="save" />
    <!-- 多选生成分镜图：弹出模型选择 -->
    <t-dialog
      v-model:visible="generateModelDialog"
      :header="$t('workbench.production.node.storyboard.selectModel')"
      :confirm-btn="$t('common.confirm')"
      :cancel-btn="$t('common.cancel')"
      :close-on-overlay-click="false"
      placement="center"
      @confirm="handleGenerateConfirm">
      <div class="generateModelBox">
        <modelSelect v-model="generateModel" :type="`image`" />
      </div>
    </t-dialog>
    <t-image-viewer
      v-model:visible="previewVisible"
      v-if="previewVisible"
      :images="previewImages"
      :onClose="closePreview"
      :onDownload="downLoadImage"
      :imageScale="{ max: 10, min: 0.1 }" />
  </t-card>
</template>

<script setup lang="ts">
import { useLocalStorage } from "@vueuse/core";
import editImage from "../components/editImage/index.vue";
import { LoadingPlugin } from "tdesign-vue-next";
import { Handle, Position, type Edge } from "@vue-flow/core";
import axios from "@/utils/axios";
import type { AssetItem, Storyboard } from "../utils/flowBuilder";
import projectStore from "@/stores/project";
import productionAgentStore from "@/stores/productionAgent";
import modelSelect from "@/components/modelSelect.vue";
const { project } = storeToRefs(projectStore());
const { episodesId } = storeToRefs(productionAgentStore());

const props = defineProps<{
  id: string;
  handleIds: {
    target: string;
    source: string;
  };
  assetsData: AssetItem[];
}>();

const storyboard = defineModel<Storyboard[]>({ required: true });

const visible = ref(false);
const previewVisible = ref(false);
const previewImages = ref<string[]>([]);
const gridScale = useLocalStorage("storyboardGridScale", 1);

const hoveredIndex = ref<number | null>(null);
const selectedIds = ref<number[]>([]);

function setHoveredFrame(index: number | null) {
  hoveredIndex.value = index;
}

function selectAll() {
  const ids = selectableIds(storyboard.value);
  selectedIds.value = ids;
  if (!ids.length) {
    window.$message.warning($t("workbench.production.node.storyboard.noSelectableFrame"));
  } else {
    window.$message.success($t("workbench.production.node.storyboard.selectedCount", { count: ids.length }));
  }
}

/**
 * 只挑出「真正带数据库 id」的分镜。
 *
 * 现场问题：全自动流程里由 agent 新增的分镜是先 push 到本地、再靠
 * prompt+duration+videoDesc 回填 id 的，prompt 重复或为空时匹配不上，
 * id 会一直是 undefined。原来的 `selectAll()` 用 `.filter(Boolean)` 静默丢掉这些项，
 * 结果就是「点了没反应、生成按钮一直 disabled」。这里改为显式挑 id 并给出反馈。
 */
function selectableIds(list: Storyboard[]) {
  return [
    ...new Set(
      list
        .map((s) => s.id)
        .filter((id): id is number => typeof id === "number" && Number.isFinite(id)),
    ),
  ];
}

// 一键选中所有生成失败的分镜，便于批量重试/删除
function selectFailed() {
  const ids = selectableIds(failedFrames.value);
  selectedIds.value = ids;
  if (!ids.length) {
    window.$message.info($t("workbench.production.node.storyboard.noFailedFrame"));
  } else {
    window.$message.success($t("workbench.production.node.storyboard.selectedCount", { count: ids.length }));
  }
}

const failedFrames = computed(() => storyboard.value.filter((s) => s.state === "生成失败"));

/** 失败原因按分类聚合，界面不用逐个点开就能看出「19 个里 11 个是审核」 */
const failureGroups = computed(() => {
  const map = new Map<string, number>();
  for (const frame of failedFrames.value) {
    const type = (frame as Storyboard & { errorType?: string }).errorType || "unknown";
    map.set(type, (map.get(type) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([type, count]) => ({ type, count, label: errorTypeLabel(type) }))
    .sort((a, b) => b.count - a.count);
});

const safetyFailedFrames = computed(() =>
  failedFrames.value.filter((s) => ((s as Storyboard & { errorType?: string }).errorType || "") === "safety"),
);

/** 分类代码 → 界面文案。后端只回稳定的 code，文案由前端管，方便多语言。 */
function errorTypeLabel(type: string) {
  const key = `workbench.production.node.storyboard.errorType.${type}`;
  const label = $t(key);
  return label === key ? $t("workbench.production.node.storyboard.errorType.unknown") : label;
}

const fixing = ref(false);

/**
 * 敏感词自愈：把触发词写进该供应商的替换规则，或让 AI 改写规避。
 * 现场问题：平台只回一句「请调整画面描述后重试」，要用户自己猜是哪个词。
 */
async function openSafetyFixDialog() {
  const ids = selectableIds(safetyFailedFrames.value);
  if (!ids.length) {
    window.$message.info($t("workbench.production.node.storyboard.noSafetyFrame"));
    return;
  }
  // 让后端从失败原因/提示词里反推疑似触发词，避免用户自己二分定位
  let candidates: { from: string; to: string }[] = [];
  try {
    const { data } = await axios.post("/production/storyboard/fixFailedPrompt", {
      storyboardIds: ids,
      action: "preview",
    });
    candidates = data?.candidates ?? [];
  } catch {
    candidates = [];
  }
  const word = ref(candidates[0]?.from ?? "");
  const replaceTo = ref(candidates[0]?.to ?? "");

  const dialog = DialogPlugin.confirm({
    header: $t("workbench.production.node.storyboard.safetyFixHeader"),
    body: () =>
      h("div", { class: "safetyFixBody" }, [
        h("p", { style: "margin:0 0 8px;color:#666" }, $t("workbench.production.node.storyboard.safetyFixTip", { count: ids.length })),
        h("label", { class: "safetyFixLabel" }, $t("workbench.production.node.storyboard.safetyFixWord")),
        // 自动识别不到触发词时给一个输入框，允许用户自己填；留空则只做 AI 改写
        candidates.length
          ? h(resolveComponent("t-select"), {
              value: word.value,
              options: candidates.map((c) => ({ label: c.from, value: c.from })),
              placeholder: $t("workbench.production.node.storyboard.safetyFixWordPh"),
              clearable: false,
              "onUpdate:value": (v: string) => {
                word.value = v;
                replaceTo.value = candidates.find((c) => c.from === v)?.to ?? "";
              },
            })
          : h(resolveComponent("t-input"), {
              value: word.value,
              placeholder: $t("workbench.production.node.storyboard.safetyFixWordPh"),
              "onUpdate:value": (v: string) => (word.value = v),
            }),
        h("label", { class: "safetyFixLabel" }, $t("workbench.production.node.storyboard.safetyFixReplaceTo")),
        h(resolveComponent("t-input"), {
          value: replaceTo.value,
          placeholder: $t("workbench.production.node.storyboard.safetyFixReplaceToPh"),
          "onUpdate:value": (v: string) => (replaceTo.value = v),
        }),
      ]),
    confirmBtn: $t("workbench.production.node.storyboard.safetyFixConfirm"),
    cancelBtn: $t("common.cancel"),
    onConfirm: async () => {
      fixing.value = true;
      try {
        // 只有「有触发词且填了替换词」才写规则，否则纯改写——
        // 避免用户在「不知道是哪个词」时被卡住
        const useRule = !!word.value && !!replaceTo.value;
        const { data } = await axios.post("/production/storyboard/fixFailedPrompt", {
          storyboardIds: ids,
          action: useRule ? "both" : "rewrite",
          word: word.value || undefined,
          replaceTo: replaceTo.value || undefined,
        });
        // 后端已把改写的提示词落库，这里同步本地状态并清掉失败标记
        for (const item of data?.rewritten ?? []) {
          const frame = storyboard.value.find((s) => s.id === item.id);
          if (frame) {
            frame.prompt = item.prompt;
            frame.state = "未生成";
            (frame as any).reason = "";
            (frame as any).errorType = "";
          }
        }
        const failed = data?.failed?.length ?? 0;
        if (failed) {
          window.$message.warning($t("workbench.production.node.storyboard.safetyFixPartial", { count: failed }));
        } else {
          window.$message.success($t("workbench.production.node.storyboard.safetyFixDone", { count: data?.rewritten?.length ?? ids.length }));
        }
        selectedIds.value = ids;
      } catch (e) {
        window.$message.error((e as any)?.message || $t("workbench.production.node.storyboard.safetyFixFailed"));
      } finally {
        fixing.value = false;
        dialog.destroy();
      }
    },
  });
}
function handleDeleteSelected() {
  const dialog = DialogPlugin.confirm({
    header: $t("workbench.assets.confirmDeleteHeader"),
    body: $t("workbench.production.node.storyboard.confirmBatchDeleteBody", { index: selectedIds.value.length }),
    confirmBtn: $t("workbench.assets.deleteBtn"),
    cancelBtn: $t("workbench.assets.cancelBtn"),
    theme: "warning",
    onConfirm: async () => {
      try {
        if (!selectedIds.value.length) {
          dialog.destroy();
          return window.$message.error($t("workbench.production.node.storyboard.pleaseSelectImage"));
        }
        const ids = [...selectedIds.value];
        // 等待后端删除成功后再更新本地，失败时保留本地数据避免前后端不一致
        await axios.post("/production/storyboard/batchDelete", {
          ids,
          projectId: project.value?.id,
        });
        storyboard.value = storyboard.value.filter((i) => !ids.includes(i.id!));
        selectedIds.value = [];
        window.$message.success($t("workbench.production.node.storyboard.deleteSuccess"));
      } catch (e) {
        window.$message.error((e as any)?.message || $t("workbench.production.node.storyboard.removeFailed"));
      } finally {
        dialog.destroy();
      }
    },
  });
}
const currentRow = ref<{
  flowId?: number | null;
  resultImages: { src: string; prompt: string }[];
  referanceImages: string[];
}>({
  flowId: null,
  resultImages: [],
  referanceImages: [],
});

const tagColors = ["#5bccb3", "#9c7cfc", "#fbbf24", "#5b9afc", "#e86b6b", "#7cb8fc", "#e8a855", "#34d399"];

function closePreview() {
  previewImages.value = [];
}
async function downLoadImage() {
  LoadingPlugin(true);
  const allIds = (storyboard.value ?? []).filter((s) => s.src).map((s) => s.id!);
  if (!allIds.length) {
    window.$message.warning($t("workbench.production.node.storyboard.noPreviewImages"));
    LoadingPlugin(false);
    return;
  }
  try {
    const res = await axios.post(
      "/production/storyboard/downPreviewImage",
      {
        storyboardIds: allIds,
      },
      { responseType: "blob" },
    );
    // 创建下载链接
    const url = URL.createObjectURL(res as unknown as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `storyboardImagePreview-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    window.$message.error($t("workbench.production.node.storyboard.imageLoadFailed"));
  } finally {
    LoadingPlugin(false);
  }
}
async function previewAll() {
  LoadingPlugin(true);
  const allIds = (storyboard.value ?? []).filter((s) => s.src).map((s) => s.id!);
  if (!allIds.length) {
    window.$message.warning($t("workbench.production.node.storyboard.noPreviewImages"));
    LoadingPlugin(false);
    return;
  }
  try {
    const { data } = await axios.post("/production/storyboard/previewImage", {
      storyboardIds: allIds,
      projectId: project.value?.id,
    });
    previewImages.value = [data];
    previewVisible.value = true;
  } catch {
    window.$message.error($t("workbench.production.node.storyboard.imageLoadFailed"));
  } finally {
    LoadingPlugin(false);
  }
}
const currentRowStoryboardInfo = ref<{ id: number | null; insertAfterIndex: number | null }>({
  id: null,
  insertAfterIndex: null,
});
const styleMaxSize = computed(() => {
  if (gridScale.value <= 1) return gridScale.value;
  return 1;
});
const generateLoading = ref(false);
const generateModelDialog = ref(false);
const generateModel = ref("");
/** 本次生成是否只补失败项（跳过已成功的分镜，避免「重跑」= 全量重来） */
const onlyFailedMode = ref(false);

// 打开模型选择对话框（多选生成分镜图）
function openGenerateDialog(onlyFailed = false) {
  if (!selectedIds.value.length) return window.$message.warning($t("workbench.production.node.storyboard.pleaseSelectImage"));
  onlyFailedMode.value = onlyFailed;
  generateModel.value = "";
  generateModelDialog.value = true;
}

/** 只补失败项：先选中失败的分镜，再走同一个生成流程 */
function retryFailedOnly() {
  const ids = selectableIds(failedFrames.value);
  if (!ids.length) return window.$message.info($t("workbench.production.node.storyboard.noFailedFrame"));
  selectedIds.value = ids;
  openGenerateDialog(true);
}

async function handleGenerateConfirm() {
  if (!generateModel.value) return window.$message.warning($t("workbench.production.node.storyboard.selectModelTip"));
  generateModelDialog.value = false;
  generateLoading.value = true;
  try {
    await productionAgentStore().batchGenerateStoryboard(selectedIds.value, true, generateModel.value, {
      onlyFailed: onlyFailedMode.value,
      // 用户已经在面板上看到过失败原因并主动补跑，不再被「资产没出图」的门禁二次打断
      acknowledgeMissingAssets: true,
    });
    window.$message.success($t("workbench.production.node.storyboard.batchGenerateSuccess"));
    selectedIds.value = [];
  } catch (e: any) {
    // 具体原因由 store 统一提示（含后端返回的门禁/分类文案），这里只兜底没文案的情况
    if (!e?.message) window.$message.error($t("workbench.production.node.storyboard.batchGenerateFailed"));
  } finally {
    generateLoading.value = false;
    onlyFailedMode.value = false;
  }
}
function editStoryboaryImage(item: Storyboard, images: string[], insertAfterIndex: number | null = null) {
  currentRowStoryboardInfo.value = {
    id: insertAfterIndex == null ? item?.id! : null,
    insertAfterIndex,
  };
  currentRow.value = {
    flowId: item?.flowId ?? null,
    resultImages: [],
    referanceImages: [],
  };

  if (currentRowStoryboardInfo.value.id) {
    let imagesPush: string[] = [];

    if (item.associateAssetsIds && item.associateAssetsIds.length > 0) {
      const assetsImages: string[] = [];
      for (const id of item.associateAssetsIds) {
        // 先查顶层 asset
        const asset = props.assetsData.find((a) => a.id === id);
        if (asset) {
          if (asset.src) assetsImages.push(asset.src);
          continue;
        }
        // 再查 derive
        for (const a of props.assetsData) {
          const derive = a.derive?.find((d) => d.id === id);
          if (derive) {
            if (derive.src) assetsImages.push(derive.src);
            break;
          }
        }
      }
      imagesPush = imagesPush.concat(assetsImages);
    }
    // if (item?.referenceIds && item.referenceIds.length > 0) {
    //   const referenImages = storyboard.value
    //     .filter((s) => item.referenceIds!.includes(s.id))
    //     .map((s) => s.src)
    //     .filter(Boolean) as string[];
    //   imagesPush = imagesPush.concat(referenImages);
    // }
    currentRow.value.referanceImages = imagesPush;
    currentRow.value.resultImages = [{ src: images.length ? images[0] : "", prompt: item.prompt ?? "" }];
  } else {
    currentRow.value.referanceImages = images.filter(Boolean);
  }
  visible.value = true;
}

async function save({ imageUrl, flowId }: { imageUrl: string; flowId: number }) {
  if (!imageUrl) return;

  const { id, insertAfterIndex } = currentRowStoryboardInfo.value;

  // 插入模式：在两张图之间新增一条分镜
  if (id === null && insertAfterIndex !== null) {
    const newFrame: Storyboard = {
      duration: 0,
      prompt: "",
      src: imageUrl,
      videoDesc: "",
      shouldGenerateImage: 1,
      state: "已完成",
    };
    const { data } = await axios.post("/production/storyboard/addStoryboard", {
      ...newFrame,
      projectId: project.value?.id,
      scriptId: episodesId.value,
      flowId,
    });

    storyboard.value.splice(insertAfterIndex + 1, 0, { ...newFrame, id: data.id!, flowId });
    productionAgentStore().setFlowData();
    return;
  }

  // 更新模式：更新对应分镜的 src
  const target = storyboard.value.find((s) => s.id === id);
  if (target) {
    target.src = imageUrl;
    target.state = "已完成";
    target.flowId = flowId;
  }
  await axios.post("/production/storyboard/updateStoryboardUrl", {
    id: id,
    url: imageUrl,
    flowId,
  });
}

async function removeFn(id: number) {
  const dialog = DialogPlugin.confirm({
    header: $t("workbench.assets.confirmDeleteHeader"),
    body: $t("workbench.production.node.storyboard.confirmDeleteBody"),
    confirmBtn: $t("workbench.assets.deleteBtn"),
    cancelBtn: $t("workbench.assets.cancelBtn"),
    theme: "warning",
    onConfirm: async () => {
      try {
        await axios.post("/production/storyboard/removeFrame", {
          id,
          projectId: project.value?.id,
        });
        const index = storyboard.value.findIndex((s) => s.id === id);
        if (index !== -1) {
          storyboard.value.splice(index, 1);
        }
      } catch (e) {
        window.$message.error((e as any)?.message || $t("workbench.production.node.storyboard.removeFailed"));
      } finally {
        dialog.destroy();
      }
    },
  });
}

function editInfo(item: Storyboard) {
  const formData = reactive({
    prompt: item.prompt ?? "",
    videoDesc: item?.videoDesc ?? "",
  });

  const bodyVNode = () =>
    h("div", { class: "editInfoForm" }, [
      h("div", { class: "editInfoField" }, [
        h("label", { class: "editInfoLabel" }, $t("workbench.production.node.storyboard.prompt")),
        h(resolveComponent("t-textarea"), {
          value: formData.prompt,
          placeholder: $t("workbench.production.node.storyboard.promptPlaceholder"),
          autosize: { minRows: 3, maxRows: 6 },
          "onUpdate:value": (v: string) => (formData.prompt = v),
        }),
      ]),
      h("div", { class: "editInfoField" }, [
        h("label", { class: "editInfoLabel" }, $t("workbench.production.node.storyboard.videoDesc")),
        h(resolveComponent("t-textarea"), {
          value: formData.videoDesc,
          placeholder: $t("workbench.production.node.storyboard.videoDescPlaceholder"),
          autosize: { minRows: 3, maxRows: 6 },
          "onUpdate:value": (v: string) => (formData.videoDesc = v),
        }),
      ]),
    ]);

  const confirmDialog = DialogPlugin.confirm({
    header: $t("workbench.production.node.storyboard.editInfo"),
    body: bodyVNode,
    width: 480,
    confirmBtn: {
      content: $t("common.submit"),
      theme: "primary",
      loading: false,
    },
    onConfirm: async () => {
      confirmDialog.update({ confirmBtn: { content: $t("common.submitting"), loading: true } });
      try {
        await axios.post("/production/storyboard/editStoryboardInfo", {
          id: item.id,
          prompt: formData.prompt,
          videoDesc: formData.videoDesc,
        });
        item.prompt = formData.prompt;
        item.videoDesc = formData.videoDesc;
        window.$message.success($t("common.editSuccess"));
      } catch (e) {
        window.$message.error((e as any)?.message || $t("common.editFailed"));
      } finally {
        confirmDialog.update({ confirmBtn: { content: $t("common.submit"), loading: false } });
        confirmDialog.destroy();
      }
    },
  });
}
</script>

<style lang="scss" scoped>
.storyboard {
  min-width: 500px;
  max-width: 100vw;
  user-select: text;
  cursor: default;

  .titleBar {
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

  .content {
    margin-top: 12px;
  }

  .frameGrid {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 0;
  }

  .frameItem {
    position: relative;
    display: inline-flex;
    align-items: flex-start;
    margin: 4px;
  }

  .addBetween {
    position: absolute;
    z-index: 10;
    top: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    pointer-events: none;
    span {
      line-height: 1;
      white-space: nowrap;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    &.expanded {
      opacity: 1;
      pointer-events: auto;
    }
    &:hover {
      // background: var(--td-brand-color);
      // color: #fff;
      // transform: scale(1.15);
    }
    &--left {
      transform: translate(calc(-50% - 4px), -50%);
    }
    &--right {
      transform: translate(calc(50% + 4px), -50%);
      right: 0;
    }
  }

  .frameCard {
    display: flex;
    flex-direction: column;
    cursor: pointer;
    transition:
      transform 0.2s,
      box-shadow 0.2s;
  }

  .frameImage {
    position: relative;
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
    transition: opacity 0.2s ease;
    &:hover {
      .remove,
      .editNode {
        opacity: 1;
      }
      .imageToolsWrap {
        opacity: 1;
        pointer-events: auto;
      }
    }
    .remove {
      position: absolute;
      top: 3px;
      right: 3px;
      z-index: 9999;
      padding: 5px;
      border-radius: 10px;
      background-color: rgba(220, 50, 50, 0.7);
      cursor: pointer;
      opacity: 0;
      transform-origin: top right;
      &:hover {
        background-color: rgba(220, 50, 50, 1);
      }
    }
    .editNode {
      position: absolute;
      bottom: 3px;
      left: 3px;
      z-index: 9999;
      padding: 5px;
      border-radius: 10px;
      background-color: rgba(24, 144, 255, 0.7);
      cursor: pointer;
      transform-origin: bottom left;
      opacity: 0;
      &:hover {
        background-color: rgba(24, 144, 255, 1);
      }
    }
  }

  .generatingPlaceholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background-color: var(--td-bg-color-container-hover, #f5f5f5);
    font-size: 12px;
  }

  .textToImageCard {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 13px;
    color: var(--td-text-color-secondary);
    transition: color 0.2s;
    .t-icon {
      color: var(--td-text-color-placeholder);
      transition: color 0.2s;
    }
    &:hover {
      color: var(--td-brand-color);
      .t-icon {
        color: var(--td-brand-color);
      }
    }
  }

  .frameImg {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .imageToolsWrap {
    position: absolute;
    right: 0;
    bottom: 0;
    z-index: 7;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
  }

  .failBadge {
    position: absolute;
    left: 3px;
    bottom: 3px;
    z-index: 6;
    padding: 2px 8px;
    border-radius: 4px;
    background-color: rgba(255, 77, 79, 0.85);
    color: #fff;
    font-size: 12px;
    line-height: 18px;
    cursor: default;
  }

  .frameCheckbox {
    position: absolute;
    left: 3px;
    top: 3px;
    z-index: 3;
    transform-origin: top left;
  }

  .frameTypeTag {
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    border: none;
    z-index: 2;
    padding: 0 4px;
    line-height: 18px;
    border-radius: 3px;
  }

  .frameTag {
    position: absolute;
    right: 8px;
    bottom: 8px;
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    border: none;
  }

  .scaleControl {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 14px;
    color: var(--td-text-color-primary, #333);
  }

  .frameInfo {
    position: absolute;
    left: 3px;
    right: 3px;
    bottom: 3px;
    z-index: 5;
    padding: 2px 6px;
    border-radius: 4px;
    background-color: rgba(0, 0, 0, 0.55);
    color: #fff;
    font-size: 11px;
    line-height: 1.5;
    max-width: calc(100% - 6px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
    &:hover {
      color: #fff;
      background-color: rgba(0, 0, 0, 0.75);
    }
    &.is-empty {
      color: rgba(255, 255, 255, 0.75);
      &:hover {
        color: rgba(255, 255, 255, 0.75);
      }
    }
  }
}
:deep(.t-image__wrapper) {
  background-color: transparent !important;
}
.editInfoForm {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 0;
}

.editInfoField {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.editInfoLabel {
  font-size: 14px;
  color: var(--td-text-color-secondary);
}

.generateModelBox {
  padding: 8px 0;
}

// 失败原因看板：把库里的 reason 抬到界面，并按分类聚合
.failPanel {
  margin-bottom: 8px;

  .failPanelBody {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .failPanelLine {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .failPanelTitle {
    font-weight: 600;
    margin-right: 4px;
  }

  .failPanelHint {
    font-size: 12px;
    color: var(--td-text-color-placeholder);
  }
}

.safetyFixBody {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.safetyFixLabel {
  margin-top: 8px;
  font-size: 13px;
  color: var(--td-text-color-secondary);
}
</style>
