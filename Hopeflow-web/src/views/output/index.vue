<template>
  <div class="output">
    <div class="header">
      <t-button @click="getList">
        <template #icon><i-redo :size="18" /></template>
        {{ $t("workbench.output.refresh") }}
      </t-button>
    </div>

    <AppEmpty v-if="!loading && list.length === 0" :description="$t('workbench.output.emptyDesc')">
      <template #action>
        <t-button theme="primary" @click="router.push('/production')">
          <template #icon><i-carousel-video :size="16" /></template>
          {{ $t("workbench.output.goProduction") }}
        </t-button>
      </template>
    </AppEmpty>

    <div v-else class="grid">
      <div class="card" v-for="item in list" :key="item.id">
        <div class="thumbWrap">
          <video v-if="item.fileUrl" :src="item.fileUrl" class="thumb" :poster="item.coverPath || ''" preload="metadata" />
          <div v-else class="thumbPlaceholder"><i-film :size="32" /></div>
          <span class="versionTag">v{{ item.version }}</span>
          <span class="durationTag" v-if="item.duration">{{ formatDuration(item.duration) }}</span>
          <div class="thumbOverlay">
            <t-button shape="circle" theme="primary" @click="playVideo(item)">
              <template #icon><i-play :size="18" /></template>
            </t-button>
          </div>
        </div>
        <div class="cardBody">
          <t-input v-if="editingId === item.id" v-model="editingName" @blur="saveRename(item)" @enter="saveRename(item)" autofocus size="small" />
          <div v-else class="nameRow" @dblclick="startRename(item)">
            <span class="name" :title="item.name">{{ item.name }}</span>
          </div>
          <div class="metaRow">
            <span class="meta" v-if="item.resolution">{{ item.resolution }}</span>
            <span class="meta" v-if="item.fileSize">{{ formatSize(item.fileSize) }}</span>
            <span class="meta">{{ dayjs(item.createTime).format("MM-DD HH:mm") }}</span>
          </div>
        </div>
        <div class="cardFooter">
          <t-button variant="text" size="small" @click="downloadVideo(item)">
            <template #icon><i-download :size="14" /></template>
            {{ $t("workbench.output.download") }}
          </t-button>
          <t-button variant="text" size="small" @click="startRename(item)">
            <template #icon><i-edit :size="14" /></template>
            {{ $t("workbench.output.rename") }}
          </t-button>
          <t-popconfirm :content="$t('workbench.output.delConfirm')" @confirm="delItem(item)">
            <t-button variant="text" size="small" theme="danger">
              <template #icon><i-delete :size="14" /></template>
              {{ $t("workbench.output.delete") }}
            </t-button>
          </t-popconfirm>
        </div>
      </div>
    </div>

    <!-- 视频预览弹窗 -->
    <t-dialog v-model:visible="previewVisible" :header="previewItem?.name" placement="center" width="720px" :footer="false" destroy-on-close>
      <video v-if="previewItem" :src="previewItem.fileUrl" controls autoplay class="previewVideo" />
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
import projectStore from "@/stores/project";
import dayjs from "dayjs";

const { project } = storeToRefs(projectStore());
const router = useRouter();

interface OutputItem {
  id: number;
  projectId: number;
  scriptId: number;
  name: string;
  filePath: string;
  coverPath: string | null;
  duration: number;
  resolution: string;
  fileSize: number;
  version: number;
  remark: string | null;
  createTime: number;
  fileUrl: string;
}

const list = ref<OutputItem[]>([]);
const loading = ref(false);

async function getList() {
  if (!project.value?.id) return;
  loading.value = true;
  try {
    const { data } = await axios.post("/output/getOutputList", { projectId: project.value.id });
    list.value = data || [];
  } finally {
    loading.value = false;
  }
}

// 预览
const previewVisible = ref(false);
const previewItem = ref<OutputItem | null>(null);
function playVideo(item: OutputItem) {
  previewItem.value = item;
  previewVisible.value = true;
}

// 下载
function downloadVideo(item: OutputItem) {
  const a = document.createElement("a");
  a.href = item.fileUrl;
  a.download = `${item.name}.mp4`;
  a.click();
}

// 重命名
const editingId = ref<number | null>(null);
const editingName = ref("");
function startRename(item: OutputItem) {
  editingId.value = item.id;
  editingName.value = item.name;
}
async function saveRename(item: OutputItem) {
  if (editingId.value === null) return;
  const name = editingName.value.trim();
  if (name && name !== item.name) {
    await axios.post("/output/updateOutput", { id: item.id, name });
    item.name = name;
  }
  editingId.value = null;
}

// 删除
async function delItem(item: OutputItem) {
  await axios.post("/output/delOutput", { id: item.id });
  list.value = list.value.filter((i) => i.id !== item.id);
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

onMounted(getList);
</script>

<style lang="scss" scoped>
.output {
  padding: 16px 0;

  .header {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    margin-bottom: 16px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 16px;
  }

  .card {
    border: 1px solid var(--td-border-level-1-color);
    border-radius: var(--td-radius-medium);
    overflow: hidden;
    background-color: var(--td-bg-color-container);
    transition: box-shadow 0.2s;

    &:hover {
      box-shadow: var(--td-shadow-2);
    }

    .thumbWrap {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      background-color: var(--td-bg-color-page);
      overflow: hidden;

      .thumb {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .thumbPlaceholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--td-text-color-placeholder);
      }

      .versionTag,
      .durationTag {
        position: absolute;
        top: 8px;
        padding: 2px 8px;
        border-radius: var(--td-radius-small);
        font-size: 12px;
        color: #fff;
        background-color: rgba(0, 0, 0, 0.6);
      }

      .versionTag {
        left: 8px;
      }

      .durationTag {
        right: 8px;
      }

      .thumbOverlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: rgba(0, 0, 0, 0.3);
        opacity: 0;
        transition: opacity 0.2s;
      }

      &:hover .thumbOverlay {
        opacity: 1;
      }
    }

    .cardBody {
      padding: 10px 12px 6px;

      .nameRow {
        cursor: pointer;

        .name {
          font-size: 14px;
          font-weight: 500;
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }

      .metaRow {
        display: flex;
        gap: 8px;
        margin-top: 4px;
        flex-wrap: wrap;

        .meta {
          font-size: 12px;
          color: var(--td-text-color-secondary);
        }
      }
    }

    .cardFooter {
      display: flex;
      border-top: 1px solid var(--td-border-level-1-color);
      padding: 4px;

      :deep(.t-button) {
        flex: 1;
      }
    }
  }

  .previewVideo {
    width: 100%;
    max-height: 70vh;
  }
}
</style>
