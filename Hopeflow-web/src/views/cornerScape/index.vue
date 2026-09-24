<template>
  <div class="cornerScape f">
    <div class="left" v-if="dataList.length > 0">
      <t-card class="card">
        <template #title>
          {{ $t("workbench.cornerScape.batchSettings") }}
          <t-tag size="small" theme="primary" variant="light" style="margin-left: 8px">{{ dataList.length }}</t-tag>
        </template>
        <t-form labelAlign="top">
          <t-form-item>
            <div class="statsBar">
              <span class="statItem" @click="selectAll">
                {{ $t("workbench.cornerScape.statTotal") }} <b>{{ stats.total }}</b>
              </span>
              <span class="sep"></span>
              <span class="statItem" @click="selectByState('已完成')">
                {{ $t("workbench.cornerScape.statDone") }} <b class="success">{{ stats.done }}</b>
              </span>
              <span class="sep"></span>
              <span class="statItem" @click="selectByState('生成失败')">
                {{ $t("workbench.cornerScape.statFailed") }} <b class="danger">{{ stats.failed }}</b>
              </span>
              <span class="sep"></span>
              <span class="statItem" @click="selectByState('')">
                {{ $t("workbench.cornerScape.statUngenerated") }} <b class="warning">{{ stats.ungenerated }}</b>
              </span>
            </div>
          </t-form-item>
          <t-form-item class="panelSection">
            <t-input v-model="keyword" :placeholder="$t('workbench.cornerScape.searchPh')" clearable>
              <template #prefix-icon><t-icon name="search" /></template>
            </t-input>
          </t-form-item>
          <t-form-item :label="$t('workbench.cornerScape.quickActions')">
            <div class="quickActions">
              <t-button size="small" theme="default" variant="outline" @click="selectAll">{{ $t("workbench.cornerScape.selectAll") }}</t-button>
              <t-button size="small" theme="default" variant="outline" @click="selectPromptEmpty()">{{ $t("workbench.cornerScape.selectPromptEmpty") }}</t-button>
              <t-button size="small" theme="default" variant="outline" @click="toggleSelectAll">{{ $t("workbench.cornerScape.invertSelection") }}</t-button>
              <t-button size="small" theme="default" variant="outline" @click="clearSelection">{{ $t("workbench.cornerScape.clearSelection") }}</t-button>
              <t-image-viewer :images="previewImages" :closeOnEscKeydown="true" :closeOnOverlay="true" class="span2">
                <template #trigger="{ open }">
                  <t-button size="small" theme="default" variant="outline" :disabled="!hasPreviewImages" @click="hasPreviewImages && open()">
                    {{ $t("workbench.cornerScape.batchPreview") }}
                  </t-button>
                </template>
              </t-image-viewer>
            </div>
          </t-form-item>
          <t-form-item :label="$t('workbench.cornerScape.filterLabel')" class="panelSection">
            <div class="row2">
              <t-select v-model="sortKey" :options="sortOptions" :placeholder="$t('workbench.cornerScape.sortBy')" />
              <t-select
                v-model="checkboxValue"
                multiple
                collapse-tags
                :options="translatedOptions"
                :placeholder="$t('workbench.cornerScape.typePh')"
                @change="onChangeFn"
              />
            </div>
          </t-form-item>

          <t-form-item :label="$t('workbench.cornerScape.genModel')">
            <modelSelect v-model="selectValue" :type="`image`" />
          </t-form-item>
          <t-form-item :label="$t('workbench.cornerScape.paramLabel')" class="panelSection">
            <div class="row2">
              <t-select
                v-model="resolution"
                :placeholder="$t('workbench.cornerScape.resolutionPh')"
                :options="resolutionOptions"
              />
              <t-input-number
                v-model="batchConcurrent"
                :min="1"
                :max="20"
                :placeholder="$t('workbench.cornerScape.concurrencyPh')"
                style="width: 100%"
              />
            </div>
          </t-form-item>
          <t-form-item :label="$t('workbench.cornerScape.textPromptInput')">
            <t-textarea
              v-model="otherTextPrompt"
              :placeholder="$t('workbench.cornerScape.textPromptPh')"
              :autosize="{ minRows: 2, maxRows: 4 }"></t-textarea>
          </t-form-item>
        </t-form>
        <template #footer>
          <div class="formFooter">
            <div class="taskProgress" v-if="taskInProgress > 0">
              <t-loading size="small" />
              <span>{{ $t("workbench.cornerScape.taskInProgress", { count: taskInProgress }) }}</span>
            </div>
            <div class="flowSteps">
              <div class="flowStep">
                <div class="stepTitle">
                  <t-icon name="edit-1" size="14" /> {{ $t("workbench.cornerScape.stepPrompt") }}
                </div>
                <div class="stepActions">
                  <t-button size="small" theme="primary" variant="outline" block @click="batchGenerationPrompt">
                    {{ $t("workbench.cornerScape.batchGenerationPrompt") }}
                  </t-button>
                  <t-button size="small" theme="default" variant="text" @click="retryFailed">
                    {{ $t("workbench.cornerScape.retryFailed") }}
                  </t-button>
                </div>
              </div>
              <div class="flowStep">
                <div class="stepTitle">
                  <t-icon name="sound" size="14" /> {{ $t("workbench.cornerScape.stepAudio") }}
                </div>
                <div class="stepActions row">
                  <t-button size="small" theme="primary" variant="outline" block @click="batchSelectBindAudio">
                    {{ $t("workbench.cornerScape.batchBingAudio") }}
                  </t-button>
                  <t-button size="small" theme="primary" variant="outline" block @click="openVoiceDialog">
                    {{ $t("workbench.cornerScape.generateRoleVoice") }}
                  </t-button>
                </div>
              </div>
              <div class="flowStep">
                <div class="stepTitle">
                  <t-icon name="image" size="14" /> {{ $t("workbench.cornerScape.stepImage") }}
                </div>
                <t-button theme="primary" block @click="batchGenerationImage">
                  {{ $t("workbench.cornerScape.startBatch") }}
                </t-button>
              </div>
            </div>
          </div>
        </template>
      </t-card>
    </div>
    <div class="content">
      <div class="floatBar" v-if="selectedIds.length > 0">
        <span class="floatInfo">{{ $t("workbench.cornerScape.selectedCount", { count: selectedIds.length }) }}</span>
        <div class="floatActions">
          <t-button size="small" theme="primary" @click="batchGenerationPrompt">{{ $t("workbench.cornerScape.batchGenerationPrompt") }}</t-button>
          <t-button size="small" theme="primary" variant="outline" @click="batchSelectBindAudio">{{ $t("workbench.cornerScape.batchBingAudio") }}</t-button>
          <t-button size="small" theme="primary" @click="batchGenerationImage">{{ $t("workbench.cornerScape.startBatch") }}</t-button>
          <t-button size="small" theme="default" variant="text" @click="clearSelection">{{ $t("workbench.cornerScape.clearSelection") }}</t-button>
        </div>
      </div>
      <t-card v-show="dataList.length > 0" class="card" v-for="item in pagedList" :key="item.id" @click="openDrawer(item)" :class="{ selected: selectedIds.includes(item.id) }">
        <div class="imageBox">
          <t-checkbox class="selectBox" :checked="selectedIds.includes(item.id)" @click.stop @change="toggleSelect(item.id)" />
          <div class="cancelGeneration" @click.stop="cancelGenerationFn(item)" v-if="item.state === '生成中'">
            <t-tag theme="danger" size="small">
              {{ $t("workbench.cornerScape.cancelGeneration") }}
            </t-tag>
          </div>
          <t-popup v-if="item.promptState === '生成失败'" :content="item.promptErrorReason || $t('workbench.cornerScape.msg.promptGenFail')">
            <t-empty type="fail" :title="$t('workbench.cornerScape.promptGenFailed')" />
          </t-popup>
          <t-empty v-else-if="!item.state && item.promptState !== '生成中'" type="maintenance" :title="$t('workbench.cornerScape.waitingGen')" />
          <div v-else-if="item.state === '生成中' || item.promptState === '生成中' || item.audioBindState == '生成中'" class="generatingBox">
            <t-loading />
            <span class="generatingText">
              {{ item.audioBindState === "生成中" ? $t("workbench.cornerScape.audioState") : $t("workbench.cornerScape.generating") }}
            </span>
          </div>
          <t-popup :content="item.errorReason" v-else-if="item.state === '生成失败'">
            <t-empty type="fail" :title="$t('workbench.cornerScape.genFailed')" />
          </t-popup>
          <div v-else-if="item.state === '待下载'" class="generatingBox">
            <t-button size="small" theme="primary" :loading="downloadingId === item.id" @click.stop="browserDownload(item)">
              {{ $t("workbench.cornerScape.browserDownload") }}
            </t-button>
            <span class="generatingText">{{ $t("workbench.cornerScape.browserDownloadTip") }}</span>
          </div>
          <t-image v-else class="image" :src="item.filePath ?? undefined" fit="contain" :preview="true" :lazy="true">
            <template #error>
              <t-empty type="fail" :title="$t('workbench.cornerScape.imageError')" />
            </template>
            <template #overlayContent>
              <div class="imageToolsWrap">
                <div class="quickOps" @click.stop>
                  <t-button size="small" variant="outline" @click.stop="openDrawer(item)" :disabled="item.state === '生成中'">
                    {{ $t("workbench.cornerScape.edit") }}
                  </t-button>
                  <t-button
                    size="small"
                    variant="outline"
                    theme="primary"
                    @click.stop="regenerateByItem(item)"
                    :disabled="item.state === '生成中' || !item.prompt">
                    {{ $t("workbench.cornerScape.regenerate") }}
                  </t-button>
                </div>
                <ImageTools :src="item.filePath!" position="br" />
              </div>
            </template>
          </t-image>
        </div>
        <div class="infoBox">
          <div class="title ac jb">
            {{ item.name }}
            <t-tag size="small" variant="outline" theme="success" v-if="item.prompt">已生成提示词</t-tag>
            <t-tag size="small" variant="outline" theme="danger" v-else>未生成提示词</t-tag>
          </div>
          <div class="meta">
            <t-tag size="small" variant="light-outline" theme="warning" class="typeTag">
              {{
                item.type === "role"
                  ? $t("workbench.cornerScape.typeRole")
                  : item.type === "scene"
                    ? $t("workbench.cornerScape.typeScene")
                    : item.type === "tool"
                      ? $t("workbench.cornerScape.typeTool")
                      : $t("workbench.cornerScape.typeUnknown")
              }}
            </t-tag>
            <t-tag size="small" variant="outline" class="stateTag" v-if="item.model">
              {{ item.model }}
            </t-tag>
            <t-tag size="small" variant="outline" v-if="item.resolution">
              {{ item.resolution }}
            </t-tag>
          </div>
          <div class="prompt" v-if="item.describe">
            {{
              item.type === "role"
                ? $t("workbench.cornerScape.typeRole")
                : item.type === "scene"
                  ? $t("workbench.cornerScape.typeScene")
                  : item.type === "tool"
                    ? $t("workbench.cornerScape.typeTool")
                    : $t("workbench.cornerScape.typeUnknown")
            }}{{ $t("workbench.cornerScape.descriptionSuffix") }}{{ item.describe }}
          </div>
          <div v-if="item.relepedAudio.length" style="margin-top: 6px">
            <t-tag
              v-for="audio in item.relepedAudio"
              :key="audio.id"
              size="small"
              variant="outline"
              theme="primary"
              class="audioTag"
              @click.stop="toggleAudioPlay(audio)">
              <template #icon>
                <t-icon :name="playingAudioId === audio.id ? 'pause-circle' : 'play-circle'" />
              </template>
              {{ audio.name }}
            </t-tag>
          </div>
        </div>
      </t-card>
      <div class="pageEmpty" v-if="dataList.length === 0">
        <AppEmpty :title="$t('workbench.cornerScape.operateScriptFirst')" />
      </div>
      <div class="paginationWrap" v-if="filteredList.length > pageSize">
        <t-pagination
          v-model:current="currentPage"
          v-model:page-size="pageSize"
          :total="filteredList.length"
          :page-size-options="[24, 48, 96]"
          show-jumper
        />
      </div>
      <t-drawer :closeBtn="true" closeOnEscKeydown :showOverlay="false" :footer="false" v-model:visible="drawerVisible" size="480px">
        <template #header>
          <div class="drawerHeader">
            <span>{{ currentItem?.name }} - {{ $t("workbench.cornerScape.individualConfig") }}</span>
            <t-tag size="medium" variant="light-outline" theme="warning">
              {{
                currentItem?.type === "role"
                  ? $t("workbench.cornerScape.typeRole")
                  : currentItem?.type === "scene"
                    ? $t("workbench.cornerScape.typeScene")
                    : currentItem?.type === "tool"
                      ? $t("workbench.cornerScape.typeTool")
                      : $t("workbench.cornerScape.typeUnknown")
              }}
            </t-tag>
          </div>
        </template>
        <div v-if="currentItem" class="drawerImageBox">
          <t-empty v-if="!currentItem.state" type="maintenance" :title="$t('workbench.cornerScape.waitingGen')" />
          <div v-else-if="currentItem.state === '生成中'" class="generatingBox">
            <t-loading />
            <span class="generatingText">{{ $t("workbench.cornerScape.generating") }}</span>
          </div>
          <div v-else-if="currentItem.state === '待下载'" class="generatingBox">
            <t-button theme="primary" :loading="downloadingId === currentItem.id" @click="browserDownload(currentItem)">
              {{ $t("workbench.cornerScape.browserDownload") }}
            </t-button>
            <span class="generatingText">{{ $t("workbench.cornerScape.browserDownloadTip") }}</span>
          </div>
          <t-empty v-else-if="currentItem.state === '生成失败'" type="fail" :title="$t('workbench.cornerScape.genFailed')" />
          <t-image v-else-if="currentItem.filePath" class="image" :src="currentItem.filePath" fit="contain">
            <template #error>
              <t-empty type="fail" :title="$t('workbench.cornerScape.imageError')" />
            </template>
            <template #overlayContent>
              <div class="imageToolsWrap show">
                <ImageTools :src="currentItem.filePath!" position="br" />
              </div>
            </template>
          </t-image>
          <t-empty v-else type="maintenance" :title="$t('workbench.cornerScape.noImage')" />
        </div>
        <t-form v-if="currentItem" labelAlign="top">
          <t-form-item :label="$t('workbench.cornerScape.history')">
            <div class="historyImageList f">
              <div
                v-for="item in currentItem.historyImages"
                :key="item.id"
                class="historyImageItem"
                :class="{ selected: selectedHistoryId === item.id }"
                @click.stop="toggleHistorySelect(item.id)">
                <t-image :src="item.filePath" :style="{ width: '100px', minWidth: '100px', height: '100px' }" :lazy="true" fit="contain" />
              </div>
            </div>
          </t-form-item>
          <t-form-item :label="$t('workbench.cornerScape.genModel')">
            <modelSelect v-model="selectValue" :type="`image`" />
          </t-form-item>
          <t-form-item :label="$t('workbench.cornerScape.resolution')">
            <t-select v-model="editForm.resolution" :placeholder="$t('workbench.cornerScape.resolutionPh')" :options="resolutionOptions" />
          </t-form-item>
          <t-form-item :label="$t('workbench.cornerScape.promptLabel')">
            <t-loading style="width: 100%" :loading="currentItem.promptState == '生成中'">
              <t-textarea
                v-model="editForm.prompt"
                :placeholder="$t('workbench.cornerScape.promptPh')"
                :autosize="{ minRows: 4, maxRows: 10 }"
                :disabled="polishing"
                @blur="savePromptOnBlur" />
            </t-loading>
          </t-form-item>
          <t-form-item :label="$t('workbench.cornerScape.assetsAudioLabel')">
            <div>
              <div>
                <t-button size="small" theme="primary" variant="outline" @click="selectAudio">
                  <template #icon><i-plus /></template>
                  {{ $t("workbench.cornerScape.selectAudio") }}
                </t-button>
              </div>
              <div class="audioList ac w" v-if="editForm.relepedAudio.length">
                <t-tag
                  v-for="audio in editForm.relepedAudio"
                  :key="audio.id"
                  closable
                  variant="light-outline"
                  class="audioTag"
                  @close="removeAudio(audio.id)"
                  @click.stop="toggleAudioPlay(audio)">
                  <template #icon>
                    <t-icon :name="playingAudioId === audio.id ? 'pause-circle' : 'play-circle'" />
                  </template>
                  {{ audio.name }}
                </t-tag>
              </div>
              <div v-else class="assets-empty">{{ $t("workbench.cornerScape.noAudio") }}</div>
            </div>
          </t-form-item>
          <t-form-item>
            <div class="drawerActions">
              <t-button
                theme="default"
                variant="outline"
                :loading="polishing"
                @click="polishPrompts"
                :disabled="currentItem.promptState == '生成中' ? true : false">
                <template #icon><t-icon name="edit" /></template>
                {{ $t("workbench.cornerScape.aiPolish") }}
              </t-button>
              <t-button theme="primary" @click="regenerateItem" :disabled="currentItem.state == '生成中' ? true : false">
                <template #icon><t-icon name="refresh" /></template>
                {{ $t("workbench.cornerScape.regenerate") }}
              </t-button>
            </div>
          </t-form-item>
        </t-form>
      </t-drawer>

      <!-- 生成独有音色弹窗 -->
      <t-dialog
        :closeBtn="true"
        closeOnEscKeydown
        :showOverlay="false"
        :footer="false"
        v-model:visible="voiceDialogVisible"
        width="640px"
        :header="$t('workbench.cornerScape.generateRoleVoice')">
        <div class="dubDialog">
          <t-radio-group v-model="voiceSource" variant="default-filled" class="voiceSourceSwitch">
            <t-radio-button value="reference">{{ $t("workbench.cornerScape.voiceReferenceMode") }}</t-radio-button>
            <t-radio-button value="text">{{ $t("workbench.cornerScape.voiceTextMode") }}</t-radio-button>
          </t-radio-group>

          <!-- 参考音频克隆模式：选 TTS 模型 + 参考音色 -->
          <template v-if="voiceSource === 'reference'">
            <t-form-item :label="$t('workbench.cornerScape.dubModel')">
              <modelSelect v-model="voiceModel" :type="`tts`" />
            </t-form-item>
            <t-form-item :label="$t('workbench.cornerScape.voiceSampleText')">
              <t-input v-model="voiceSampleText" :placeholder="$t('workbench.cornerScape.voiceSampleTextPh')" />
            </t-form-item>
            <div class="dubRoleList">
              <div v-for="role in voiceRoles" :key="role.roleId" class="dubRole">
                <div class="dubRoleHeader">
                  <span class="dubRoleName">{{ role.roleName }}</span>
                  <t-tag v-if="role.hasBoundAudio" size="small" theme="success" variant="light">
                    {{ $t("workbench.cornerScape.dubBoundAudio") }}：{{ role.boundAudioName }}
                  </t-tag>
                  <t-tag v-else size="small" theme="warning" variant="light">{{ $t("workbench.cornerScape.dubNoBoundAudio") }}</t-tag>
                </div>
                <div v-if="!role.hasBoundAudio" class="dubRefRow">
                  <span class="dubRefLabel">{{ $t("workbench.cornerScape.dubReferenceAudio") }}</span>
                  <AudioUploadBox v-model="voiceRefFiles[role.roleId]" :label="$t('workbench.cornerScape.dubUploadReference')" />
                </div>
              </div>
            </div>
          </template>

          <!-- 文字描述生成模式：DashScope 文生音色，按角色填写音色描述（可智能生成后编辑） -->
          <template v-else>
            <t-form-item :label="$t('workbench.cornerScape.voicePreviewText')">
              <t-input v-model="voiceSampleText" :placeholder="$t('workbench.cornerScape.voicePreviewTextPh')" />
            </t-form-item>
            <div class="voicePromptToolbar">
              <t-button size="small" variant="outline" theme="primary" :loading="voicePromptLoading" @click="handleGenVoicePrompts">
                {{ $t("workbench.cornerScape.genVoicePromptByAI") }}
              </t-button>
            </div>
            <div class="dubRoleList">
              <div v-for="role in voiceRoles" :key="role.roleId" class="dubRole">
                <div class="dubRoleHeader">
                  <span class="dubRoleName">{{ role.roleName }}</span>
                </div>
                <t-textarea
                  v-model="voicePrompts[role.roleId]"
                  :placeholder="$t('workbench.cornerScape.voicePromptPlaceholder')"
                  :autosize="{ minRows: 2, maxRows: 4 }"
                />
              </div>
            </div>
          </template>

          <div class="dialogFooter">
            <t-button variant="outline" @click="voiceDialogVisible = false">{{ $t("workbench.cornerScape.cancelBtn") }}</t-button>
            <t-button theme="primary" :loading="voiceLoading" :disabled="voiceRoles.length === 0" @click="handleVoiceGenerate">
              <template #icon><i-lightning theme="outline" /></template>
              {{ $t("workbench.cornerScape.dubStart") }}
            </t-button>
          </div>
        </div>
      </t-dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
import projectStore from "@/stores/project";
import modelSelect from "@/components/modelSelect.vue";
import settingStore from "@/stores/setting";
import openAssetsSelector from "@/utils/assetsCheck";
import AudioUploadBox from "@/components/setting/components/vendorTest/AudioUploadBox.vue";
import AppEmpty from "@/components/feedback/AppEmpty.vue";

const { otherSetting } = storeToRefs(settingStore());
interface Image {
  filePath: string;
  id: number;
}
interface DataItem {
  id: number;
  imageId: number;
  type: string;
  name: string;
  prompt: string;
  filePath: string | null;
  state: string;
  model: string;
  resolution: string;
  describe: string;
  promptState: string;
  historyImages: Image[];
  errorReason: string;
  promptErrorReason: string;
  relepedAudio: { id: number; name: string; filePath?: string }[];
  audioBindState: string;
}

const checkboxValue = ref<string[]>([]);
const { project } = storeToRefs(projectStore());
const selectValue = ref(project.value?.imageModel ?? "");
const resolution = ref("1K");
const otherTextPrompt = ref("");
const resolutionOptions = [
  { label: "1K", value: "1K" },
  { label: "2K", value: "2K" },
  { label: "4K", value: "4K" },
];
const options = ref([
  { labelKey: "workbench.cornerScape.filterRole", value: "role" },
  { labelKey: "workbench.cornerScape.filterScene", value: "scene" },
  { labelKey: "workbench.cornerScape.filterTool", value: "tool" },
]);

const translatedOptions = computed(() =>
  options.value.map((opt) => ({
    ...opt,
    label: $t(opt.labelKey),
  })),
);
const dataList = ref<DataItem[]>([]);
const loading = ref(false);

// ── 页面层增强：搜索 / 排序 / 统计 / 分页 ──
const keyword = ref("");
const filteredList = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return dataList.value;
  return dataList.value.filter(
    (i) => (i.name ?? "").toLowerCase().includes(kw) || (i.describe ?? "").toLowerCase().includes(kw),
  );
});
const sortKey = ref("default");
const sortOptions = computed(() => [
  { label: $t("workbench.cornerScape.sortDefault"), value: "default" },
  { label: $t("workbench.cornerScape.sortName"), value: "name" },
  { label: $t("workbench.cornerScape.sortState"), value: "state" },
]);
const sortedList = computed(() => {
  const list = [...filteredList.value];
  if (sortKey.value === "name") list.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  else if (sortKey.value === "state") {
    const order = (s?: string) => (s === "生成失败" ? 0 : s ? 1 : 2);
    list.sort((a, b) => order(a.state) - order(b.state));
  }
  return list;
});
const currentPage = ref(1);
const pageSize = ref(24);
const pagedList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return sortedList.value.slice(start, start + pageSize.value);
});
watch([keyword, sortKey, checkboxValue], () => {
  currentPage.value = 1;
});
const stats = computed(() => {
  const list = dataList.value;
  return {
    total: list.length,
    done: list.filter((i) => i.state === "已完成").length,
    failed: list.filter((i) => i.state === "生成失败").length,
    ungenerated: list.filter((i) => !i.state).length,
  };
});
// 页面可调并发数（默认取全局设置）
const batchConcurrent = ref(otherSetting.value.assetsBatchGenereateSize ?? 1);

// ── 生成独有音色弹窗状态 ──
interface VoiceRole {
  roleId: number;
  roleName: string;
  hasBoundAudio: boolean;
  boundAudioName: string;
}
const voiceDialogVisible = ref(false);
const voiceModel = ref("");
const voiceLoading = ref(false);
const voiceRoles = ref<VoiceRole[]>([]);
const voiceRefFiles = reactive<Record<number, File | null>>({});
const voiceSampleText = ref("");
const voiceSource = ref<"reference" | "text">("reference");
const voicePrompts = reactive<Record<number, string>>({});
const voicePromptLoading = ref(false);

// 打开生成独有音色弹窗：基于选中角色，无需台词解析
function openVoiceDialog() {
  const roleItems = dataList.value.filter((item) => selectedIds.value.includes(item.id) && item.type === "role");
  if (roleItems.length === 0) {
    window.$message.warning($t("workbench.cornerScape.msg.selectAtLeastBindOne"));
    return;
  }
  voiceDialogVisible.value = true;
  voiceModel.value = "";
  voiceSampleText.value = "";
  voiceSource.value = "reference";
  voiceRoles.value = roleItems.map((item) => ({
    roleId: item.id,
    roleName: item.name,
    hasBoundAudio: item.relepedAudio.length > 0,
    boundAudioName: item.relepedAudio[0]?.name ?? "",
  }));
  Object.keys(voiceRefFiles).forEach((k) => delete voiceRefFiles[Number(k)]);
  Object.keys(voicePrompts).forEach((k) => delete voicePrompts[Number(k)]);
}

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string); // data:audio/...;base64,xxxx
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// 智能生成各角色音色描述（voice_prompt），供「文字描述生成」模式使用
async function handleGenVoicePrompts() {
  if (voiceRoles.value.length === 0) return;
  voicePromptLoading.value = true;
  try {
    const { data } = await axios.post(
      "/cornerScape/generateVoicePrompt",
      {
        projectId: project.value?.id,
        roleIds: voiceRoles.value.map((r) => r.roleId),
      },
      { silent: true },
    );
    if (data && typeof data === "object") {
      let count = 0;
      voiceRoles.value.forEach((r) => {
        const p = data[r.roleId];
        if (p) {
          voicePrompts[r.roleId] = p;
          count++;
        }
      });
      window.$message.success($t("workbench.cornerScape.msg.voicePromptGenerated", { count }));
    }
  } catch (e: any) {
    window.$message.error(e?.message ?? $t("workbench.cornerScape.msg.promptGenFail"));
  } finally {
    voicePromptLoading.value = false;
  }
}

// 生成独有音色
async function handleVoiceGenerate() {
  if (voiceSource.value === "reference") {
    if (!voiceModel.value) {
      window.$message.warning($t("workbench.cornerScape.msg.selectModel"));
      return;
    }
    const targets = voiceRoles.value.filter((r) => r.hasBoundAudio || voiceRefFiles[r.roleId]);
    if (targets.length === 0) {
      window.$message.warning($t("workbench.cornerScape.dubNeedReference"));
      return;
    }
    voiceLoading.value = true;
    try {
      const referenceAudios: Record<string, string> = {};
      for (const r of targets) {
        const file = voiceRefFiles[r.roleId];
        if (file) referenceAudios[String(r.roleId)] = await fileToBase64(file);
      }
      // 前端先将目标角色标记为"生成中"，由轮询自动接管状态跟踪
      targets.forEach((r) => {
        const target = dataList.value.find((row) => row.id === r.roleId);
        if (target) target.audioBindState = "生成中";
      });
      await axios.post(
        "/cornerScape/generateRoleVoice",
        {
          projectId: project.value?.id,
          model: voiceModel.value,
          roleIds: targets.map((r) => r.roleId),
          concurrentCount: batchConcurrent.value,
          referenceAudios,
          sampleText: voiceSampleText.value.trim() || undefined,
          voiceSource: "reference",
        },
        { silent: true },
      );
      voiceDialogVisible.value = false;
      selectedIds.value = [];
      window.$message.success($t("workbench.cornerScape.msg.voiceStarted", { count: targets.length }));
    } catch (e: any) {
      targets.forEach((r) => {
        const target = dataList.value.find((row) => row.id === r.roleId);
        if (target) target.audioBindState = "";
      });
      window.$message.error(e?.message ?? $t("workbench.cornerScape.msg.promptGenFail"));
    } finally {
      voiceLoading.value = false;
    }
    return;
  }

  // 文字描述生成模式（DashScope 文生音色）
  const targets = voiceRoles.value.filter((r) => voicePrompts[r.roleId]?.trim());
  if (targets.length === 0) {
    window.$message.warning($t("workbench.cornerScape.msg.voicePromptEmpty"));
    return;
  }
  voiceLoading.value = true;
  try {
    targets.forEach((r) => {
      const target = dataList.value.find((row) => row.id === r.roleId);
      if (target) target.audioBindState = "生成中";
    });
    const promptMap: Record<string, string> = {};
    targets.forEach((r) => {
      promptMap[String(r.roleId)] = voicePrompts[r.roleId].trim();
    });
    await axios.post(
      "/cornerScape/generateRoleVoice",
      {
        projectId: project.value?.id,
        roleIds: targets.map((r) => r.roleId),
        concurrentCount: batchConcurrent.value,
        sampleText: voiceSampleText.value.trim() || undefined,
        voiceSource: "text",
        voicePrompts: promptMap,
      },
      { silent: true },
    );
    voiceDialogVisible.value = false;
    selectedIds.value = [];
    window.$message.success($t("workbench.cornerScape.msg.voiceStarted", { count: targets.length }));
  } catch (e: any) {
    targets.forEach((r) => {
      const target = dataList.value.find((row) => row.id === r.roleId);
      if (target) target.audioBindState = "";
    });
    window.$message.error(e?.message ?? $t("workbench.cornerScape.msg.promptGenFail"));
  } finally {
    voiceLoading.value = false;
  }
}

// 用于取消进行中的生成请求
let abortController: AbortController | null = null;

function createAbortController() {
  abortController?.abort();
  abortController = new AbortController();
  return abortController;
}

onMounted(() => {
  getFilteredData();
});

// AI 创建的项目：进入页面时自动把项目简介填入"提示词附加指令"，避免批量生成提示词时该字段为空
watch(
  () => project.value?.id,
  (id) => {
    if (id) otherTextPrompt.value = project.value?.intro ?? "";
  },
  { immediate: true },
);

onUnmounted(() => {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  stopPolling();
  stopImagePolling();
  stopAudioPolling();
  audioPlayer?.pause();
  audioPlayer = null;
  // 将所有"生成中"的项重置为空状态
  dataList.value.forEach((item) => {
    if (item.state === "生成中") item.state = "";
  });
});
function onChangeFn() {
  getFilteredData();
}
async function getFilteredData() {
  try {
    loading.value = true;
    const { data } = await axios.post("/cornerScape/getAllAssets", {
      projectId: project.value?.id,
      type: checkboxValue.value,
    });
    dataList.value = data;
    syncSelectedIdsWithData();
  } catch (error) {
    console.error("加载资产数据失败:", error);
    dataList.value = [];
    selectedIds.value = [];
  } finally {
    loading.value = false;
  }
}

const selectedIds = ref<number[]>([]);

function syncSelectedIdsWithData() {
  const visibleIds = new Set(dataList.value.map((item) => item.id));
  selectedIds.value = Array.from(new Set(selectedIds.value)).filter((id) => visibleIds.has(id));
}

const previewImages = computed((): string[] => {
  const selectedImageList = dataList.value
    .filter((item) => selectedIds.value.includes(item.id) && item.filePath)
    .map((item) => item.filePath as string);

  if (selectedImageList.length > 0) {
    return selectedImageList;
  }

  return dataList.value.filter((item) => item.filePath).map((item) => item.filePath as string);
});

const hasPreviewImages = computed(() => previewImages.value.length > 0);

const toggleSelect = (id: number) => {
  const idx = selectedIds.value.indexOf(id);
  if (idx === -1) selectedIds.value.push(id);
  else selectedIds.value.splice(idx, 1);
};

const selectByState = (state: string) => {
  selectedIds.value = dataList.value.filter((item) => (state === "" ? !item.state : item.state === state)).map((item) => item.id);
};
//全选提示词为空的
function selectPromptEmpty() {
  const lite = dataList.value.filter((item) => !item.prompt || item.prompt.trim() === "").map((item) => item.id);
  if (lite.length === 0) {
    window.$message.warning($t("workbench.cornerScape.noEmptyPrompt"));
    return;
  }
  selectedIds.value = lite;
  window.$message.success($t("workbench.cornerScape.selectedCount", { count: selectedIds.value.length }));
}

function selectAll() {
  selectedIds.value = dataList.value.map((item) => item.id);
}

function toggleSelectAll() {
  if (selectedIds.value.length === dataList.value.length) {
    selectedIds.value = [];
  } else {
    selectedIds.value = dataList.value.map((item) => item.id);
  }
}
function clearSelection() {
  selectedIds.value = [];
}
//取消生成
async function cancelGenerationFn(item: DataItem) {
  const dialog = DialogPlugin.confirm({
    header: $t("workbench.assets.confirmCancellation"),
    body: $t("workbench.assets.confirmAgain"),
    confirmBtn: $t("workbench.assets.sure"),
    cancelBtn: $t("workbench.assets.cancelBtn"),
    theme: "warning",
    onConfirm: async () => {
      try {
        if (!item.imageId) {
          window.$message.warning($t("workbench.cornerScape.noGenerating"));
          return;
        }
        await axios.post("/assetsGenerate/cancelGenerate", {
          id: item.imageId,
        });
        window.$message.success($t("workbench.cornerScape.cancelGeneration") + " " + item.name);
      } catch (e: any) {
        window.$message.error(e.message ?? $t("workbench.cornerScape.cancelGeneration") + "失败");
      } finally {
        getFilteredData();
        dialog.destroy();
      }
    },
  });
}

// ── 音色试听（单例播放，仅允许一个同时播放） ──
const playingAudioId = ref<number | null>(null);
let audioPlayer: HTMLAudioElement | null = null;
function toggleAudioPlay(audio: { id: number; filePath?: string }) {
  if (!audio.filePath) {
    window.$message.warning($t("workbench.cornerScape.audioNoFile"));
    return;
  }
  if (playingAudioId.value === audio.id) {
    audioPlayer?.pause();
    playingAudioId.value = null;
    return;
  }
  playingAudioId.value = audio.id;
  if (!audioPlayer) {
    audioPlayer = new Audio();
    audioPlayer.addEventListener("ended", () => {
      playingAudioId.value = null;
    });
  }
  audioPlayer.src = audio.filePath;
  audioPlayer.play().catch(() => {
    playingAudioId.value = null;
  });
}

// Drawer
const drawerVisible = ref(false);
const currentItem = ref<DataItem | null>(null);
const selectedHistoryId = ref<number | null>(null);

async function toggleHistorySelect(id: number) {
  selectedHistoryId.value = selectedHistoryId.value === id ? null : id;
  if (!currentItem.value) return;
  const selectedImage = currentItem.value.historyImages.find((img) => img.id === selectedHistoryId.value);
  try {
    await axios.post("/assets/saveAssets", {
      id: currentItem.value.id,
      type: currentItem.value.type,
      projectId: project.value?.id,
      prompt: currentItem.value.prompt,
      imageId: selectedImage?.id,
    });
    //拿选中的图片替换当前图片
    if (selectedImage) {
      currentItem.value.filePath = selectedImage.filePath;
      currentItem.value.state = "已完成";
    }
    getFilteredData();
    window.$message.success($t("workbench.cornerScape.msg.replaceSuccess"));
  } catch (e) {
    window.$message.error($t("workbench.cornerScape.msg.replaceFailed"));
    return;
  }
}

const editForm = reactive({
  assetsId: 0,
  model: "",
  type: "",
  resolution: "",
  prompt: "",
  name: "",
  describe: "",
  promptState: "",
  relepedAudio: [] as { id: number; name: string; filePath?: string }[],
});

async function openDrawer(item: DataItem) {
  if (item.state == "生成中") return;
  selectedHistoryId.value = null;
  // 先用当前数据打开抽屉
  editForm.assetsId = item.id;
  editForm.name = item.name || "";
  editForm.type = item.type || "";
  editForm.model = item.model || "";
  currentItem.value = item;
  editForm.resolution = item.resolution || "";
  editForm.prompt = item.prompt || "";
  editForm.describe = item.describe || "";
  editForm.promptState = item.promptState;
  editForm.relepedAudio = item?.relepedAudio ?? [];

  drawerVisible.value = true;
  // 重新获取最新数据（含历史图片）
  try {
    const { data } = await axios.post("/cornerScape/getAllAssets", {
      projectId: project.value?.id,
      type: checkboxValue.value,
    });
    const freshItem = (data as DataItem[]).find((d) => d.id === item.id);
    if (freshItem) {
      // 更新 dataList 中对应项
      const idx = dataList.value.findIndex((d) => d.id === item.id);
      if (idx !== -1) dataList.value[idx] = freshItem;
      // 更新当前抽屉项
      currentItem.value = freshItem;
      editForm.prompt = freshItem.prompt || editForm.prompt;
      editForm.resolution = freshItem.resolution || editForm.resolution;
    }
  } catch (e) {
    console.error("刷新资产详情失败:", e);
  }
}

function setItemState(id: number, state: string) {
  const item = dataList.value.find((i) => i.id === id);
  if (item) item.state = state;
  if (currentItem.value?.id === id) currentItem.value.state = state;
}

// 正在通过浏览器下载的资产 id（用于按钮 loading 态）
const downloadingId = ref<number | null>(null);
/**
 * 浏览器下载：服务端因 CDN 限速/挂起无法下载结果文件时，
 * 由浏览器（走用户代理/代理）直接下载原始 URL，转 base64 后回传后端保存为资产文件。
 */
async function browserDownload(item: DataItem) {
  const url = item.errorReason;
  if (!url) {
    window.$message.warning($t("workbench.cornerScape.browserDownloadMissingUrl"));
    return;
  }
  if (!item.imageId) {
    window.$message.warning($t("workbench.cornerScape.browserDownloadMissingImage"));
    return;
  }
  downloadingId.value = item.id;
  try {
    // 1. 浏览器走用户代理下载结果文件
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${$t("workbench.cornerScape.browserDownloadHttpFail")}: HTTP ${res.status}`);
    const blob = await res.blob();
    // 2. 转 base64（带 data URL 头，供后端落盘）
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error($t("workbench.cornerScape.browserDownloadReadFail")));
      reader.readAsDataURL(blob);
    });
    // 3. 回传后端保存为资产文件
    await axios.post("/assetsGenerate/saveDownloadedAsset", {
      imageId: item.imageId,
      base64,
    });
    window.$message.success($t("workbench.cornerScape.browserDownloadSuccess"));
    await getFilteredData();
  } catch (e: any) {
    window.$message.error(e?.message ?? $t("workbench.cornerScape.browserDownloadFail"));
  } finally {
    downloadingId.value = null;
  }
}

// 公共重生成逻辑：抽屉与卡片快捷重生成共用
async function doRegenerate(item: DataItem, prompt: string, resolution: string) {
  if (item.state === "生成中") return;
  if (!selectValue.value) {
    window.$message.warning($t("workbench.cornerScape.msg.selectModel"));
    return;
  }
  if (!resolution) {
    window.$message.warning($t("workbench.cornerScape.msg.selectResolution"));
    return;
  }
  if (!prompt.trim()) {
    window.$message.warning($t("workbench.cornerScape.msg.enterPrompt"));
    return;
  }
  setItemState(item.id, "生成中");
  if (currentItem.value?.id === item.id) drawerVisible.value = false;
  const controller = createAbortController();
  axios
    .post(
      "/assetsGenerate/generateAssets",
      {
        type: item.type ?? "props",
        projectId: project.value?.id,
        name: item.name ?? $t("workbench.cornerScape.unnamed"),
        base64: "",
        prompt,
        model: selectValue.value,
        id: item.id,
        resolution,
        concurrentCount: 1,
      },
      { signal: controller.signal, silent: true },
    )
    .then(async () => {
      window.$message.success($t("workbench.cornerScape.msg.genSuccess", { name: item.name }));
      await getFilteredData();
    })
    .catch((e: any) => {
      if (e.name === "CanceledError" || e.code === "ERR_CANCELED") return;
      window.$message.error(e.message ?? $t("workbench.cornerScape.msg.genFailed", { name: item.name }));
      setItemState(item.id, "生成失败");
    });
}

function regenerateItem() {
  if (!currentItem.value) return;
  doRegenerate(currentItem.value, editForm.prompt, editForm.resolution);
}

// 卡片快捷重生成：用资产自身提示词（未单独设置分辨率时用页面默认）
function regenerateByItem(item: DataItem) {
  doRegenerate(item, item.prompt ?? "", item.resolution || resolution.value);
}

// 提示词失焦保存
async function savePromptOnBlur() {
  if (!currentItem.value) return;
  // 内容没有变化则不保存
  if (editForm.prompt === currentItem.value.prompt) return;
  try {
    await axios.post("/assets/saveAssets", {
      id: currentItem.value.id,
      type: currentItem.value.type,
      projectId: project.value?.id,
      prompt: editForm.prompt,
    });
    // 同步更新本地数据
    currentItem.value.prompt = editForm.prompt;
    const target = dataList.value.find((d) => d.id === currentItem.value!.id);
    if (target) target.prompt = editForm.prompt;
    window.$message.success($t("workbench.cornerScape.msg.saveSuccess"));
  } catch (e) {
    window.$message.error($t("workbench.cornerScape.msg.saveFailed"));
  }
}

// AI 润色
const polishing = ref(false);
async function polishPrompts() {
  if (!editForm.prompt.trim()) {
    window.$message.warning($t("workbench.cornerScape.msg.enterPromptFirst"));
    return;
  }
  polishing.value = true;
  try {
    const { data } = await axios.post("/assetsGenerate/polishAssetsPrompt", {
      projectId: project.value?.id,
      assetsId: editForm.assetsId,
      type: editForm.type ?? "props",
      name: editForm.name,
      describe: editForm.describe,
    });
    window.$message.success($t("workbench.cornerScape.msg.promptGenSuccess"));
    if (data.assetsId === editForm.assetsId) {
      editForm.prompt = data.prompt;
    }
    getFilteredData();
  } catch (e) {
    window.$message.error((e as any)?.message ?? $t("workbench.cornerScape.msg.polishFailed"));
  } finally {
    polishing.value = false;
  }
}
//批量生成提示词
async function batchGenerationPrompt() {
  if (selectedIds.value.length === 0) {
    window.$message.warning($t("workbench.cornerScape.msg.selectAtLeastOne"));
    return;
  }

  const items = dataList.value.filter((item) => selectedIds.value.includes(item.id));

  // 前端先将所有选中项的 promptState 标记为"生成中"，让轮询自动接管状态跟踪
  items.forEach((item) => {
    item.promptState = "生成中";
  });

  // 清除已选中的项
  selectedIds.value = [];

  try {
    await axios.post("/assetsGenerate/batchPolishAssetsPrompt", {
      projectId: project.value?.id,
      items: items.map((item) => ({
        assetsId: item.id,
        type: item.type ?? "props",
        name: item.name,
        describe: item.describe,
      })),
      concurrentCount: batchConcurrent.value,
      otherTextPrompt: otherTextPrompt.value,
    });
  } catch (e: any) {
    window.$message.error(e?.message ?? $t("workbench.cornerScape.msg.promptGenFail"));
    // 生成失败时重置 promptState
    items.forEach((item) => {
      const target = dataList.value.find((row) => row.id === item.id);
      if (target) target.promptState = "";
    });
  }
}
//绑定音频
async function batchSelectBindAudio() {
  if (selectedIds.value.length === 0) {
    window.$message.warning($t("workbench.cornerScape.msg.selectAtLeastBindOne"));
    return;
  }

  const items = dataList.value.filter((item) => selectedIds.value.includes(item.id));

  // 前端先将所有选中项的 promptState 标记为"生成中"，让轮询自动接管状态跟踪
  items.forEach((item) => {
    item.audioBindState = "生成中";
  });

  // 清除已选中的项
  selectedIds.value = [];

  try {
    await axios.post("/cornerScape/batchBindAudio", {
      projectId: project.value?.id,
      assetsIds: items.map((item) => item.id),
      concurrentCount: batchConcurrent.value,
    }, { silent: true });
  } catch (e: any) {
    window.$message.error(e.message ?? $t("workbench.cornerScape.msg.promptGenFail"));
    // 生成失败时重置 audioBindState
    items.forEach((item) => {
      const target = dataList.value.find((row) => row.id === item.id);
      if (target) target.audioBindState = "";
    });
  }
}
// 批量生成图片
async function batchGenerationImage() {
  if (selectedIds.value.length === 0) {
    window.$message.warning($t("workbench.cornerScape.msg.selectAtLeastOne"));
    return;
  }
  if (!selectValue.value) {
    window.$message.warning($t("workbench.cornerScape.msg.selectModel"));
    return;
  }
  if (!resolution.value) {
    window.$message.warning($t("workbench.cornerScape.msg.selectResolution"));
    return;
  }

  const items = dataList.value.filter((item) => selectedIds.value.includes(item.id));
  //检查如果勾选的数据prompt有空的，提示用户勾选的哪一个提示词未生成，然后终止批量生成
  const emptyPrompts = items.filter((item) => !item.prompt);
  if (emptyPrompts.length > 0) {
    const emptyPromptNames = emptyPrompts.map((item) => item.name).join(", ");
    window.$message.warning(
      $t("workbench.cornerScape.msg.emptyPrompt", {
        emptyPromptNames,
      }),
    );
    return;
  }

  // 前端先将所有选中项标记为"生成中"
  items.forEach((item) => setItemState(item.id, "生成中"));

  window.$message.success(
    $t("workbench.cornerScape.msg.batchStarted", { count: items.length, concurrent: otherSetting.value.assetsBatchGenereateSize }),
  );

  try {
    await axios.post("/assetsGenerate/batchGenerateImageAssets", {
      projectId: project.value?.id,
      model: selectValue.value,
      resolution: resolution.value,
      concurrentCount: batchConcurrent.value,
      items: items.map((item) => ({
        id: item.id,
        type: item.type ?? "props",
        name: item.name ?? $t("workbench.cornerScape.unnamed"),
        prompt: item.prompt,
      })),
    });
    selectedIds.value = [];
  } catch (e: any) {
    if (e.name === "CanceledError" || e.code === "ERR_CANCELED") return;
    window.$message.error(e.message ?? $t("workbench.cornerScape.msg.batchFailed"));
  }
}
// 失败项一键重试：提示词失败 → 重新润色；图片失败（有提示词）→ 重新生成
async function retryFailed() {
  const promptFailed = dataList.value.filter((i) => i.promptState === "生成失败" && !i.prompt);
  const imgFailed = dataList.value.filter((i) => i.state === "生成失败" && i.prompt);
  if (!promptFailed.length && !imgFailed.length) {
    window.$message.warning($t("workbench.cornerScape.msg.noFailedToRetry"));
    return;
  }
  if (!selectValue.value) {
    window.$message.warning($t("workbench.cornerScape.msg.selectModel"));
    return;
  }
  if (!resolution.value) {
    window.$message.warning($t("workbench.cornerScape.msg.selectResolution"));
    return;
  }
  // 高亮失败项便于核对
  selectedIds.value = dataList.value.filter((i) => i.state === "生成失败").map((i) => i.id);
  try {
    if (promptFailed.length) {
      promptFailed.forEach((item) => {
        item.promptState = "生成中";
      });
      await axios.post("/assetsGenerate/batchPolishAssetsPrompt", {
        projectId: project.value?.id,
        items: promptFailed.map((item) => ({
          assetsId: item.id,
          type: item.type ?? "props",
          name: item.name,
          describe: item.describe,
        })),
        concurrentCount: batchConcurrent.value,
        otherTextPrompt: otherTextPrompt.value,
      });
    }
    if (imgFailed.length) {
      imgFailed.forEach((item) => setItemState(item.id, "生成中"));
      await axios.post("/assetsGenerate/batchGenerateImageAssets", {
        projectId: project.value?.id,
        model: selectValue.value,
        resolution: resolution.value,
        concurrentCount: batchConcurrent.value,
        items: imgFailed.map((item) => ({
          id: item.id,
          type: item.type ?? "props",
          name: item.name,
          prompt: item.prompt,
        })),
      });
    }
    window.$message.success($t("workbench.cornerScape.msg.retryStarted", { count: promptFailed.length + imgFailed.length }));
  } catch (e: any) {
    window.$message.error(e?.message ?? $t("workbench.cornerScape.msg.promptGenFail"));
  }
}
//轮询
const notCompultedData = computed(() => {
  return dataList.value.filter((item) => item.promptState == "生成中");
});
const generatingData = computed(() => {
  return dataList.value.filter((item) => item.state === "生成中");
});
const audioBindData = computed(() => {
  return dataList.value.filter((item) => item.audioBindState === "生成中");
});
// 批量任务进行中数量（提示词 / 图片 / 音频绑定）
const taskInProgress = computed(
  () => notCompultedData.value.length + generatingData.value.length + audioBindData.value.length,
);
// 轮询相关
let pollingTimer: ReturnType<typeof setInterval> | null = null;
let imagePollingTimer: ReturnType<typeof setInterval> | null = null;
let audioBindPollingTimer: ReturnType<typeof setInterval> | null = null;

//轮询提示词生成
async function pollingPromptAssets() {
  if (notCompultedData.value.length === 0) return;
  const ids = notCompultedData.value.map((item) => item.id);
  try {
    const { data } = await axios.post("/assets/pollingPromptAssets", { ids });
    let hasCompleted = false;
    if (Array.isArray(data) && data.length) {
      data.forEach((item: { id: number; promptState: string; prompt: string; promptErrorReason?: string }) => {
        const target = dataList.value.find((row) => row.id === item.id);
        if (target) {
          if (target.promptState === "生成中" && item.promptState !== "生成中") hasCompleted = true;
          target.promptState = item.promptState;
          if (item.prompt !== undefined) target.prompt = item.prompt;
          if (item.promptErrorReason !== undefined) target.promptErrorReason = item.promptErrorReason;
        }
      });
    }
    // 有提示词生成完成时，重新获取完整数据以刷新 historyImages
    if (hasCompleted) {
      try {
        const { data: freshData } = await axios.post("/cornerScape/getAllAssets", {
          projectId: project.value?.id,
          type: checkboxValue.value,
        });
        (freshData as DataItem[]).forEach((fresh) => {
          const target = dataList.value.find((row) => row.id === fresh.id);
          if (target) target.historyImages = fresh.historyImages;
        });
        // 同步更新抽屉中的当前项
        if (currentItem.value) {
          const freshCurrent = (freshData as DataItem[]).find((d) => d.id === currentItem.value!.id);
          if (freshCurrent) currentItem.value.historyImages = freshCurrent.historyImages;
        }
      } catch (e) {
        console.error("刷新历史图片失败:", e);
      }
    }
  } catch (e) {
    console.error("轮询提示词状态失败:", e);
  }
}
//轮询图片生成
async function pollingImageAssets() {
  if (generatingData.value.length === 0) return;
  const ids = generatingData.value.map((item) => item.id);
  try {
    const { data } = await axios.post("/assets/pollingImageAssets", { ids });
    let hasCompleted = false;
    if (Array.isArray(data) && data.length) {
      data.forEach((item: { id: number; state: string; filePath: string; errorReason?: string }) => {
        const target = dataList.value.find((row) => row.id === item.id);
        if (target) {
          if (target.state === "生成中" && item.state !== "生成中") hasCompleted = true;
          target.state = item.state;
          if (item.errorReason !== undefined) target.errorReason = item.errorReason ?? "";
          if (item.filePath !== undefined) target.filePath = item.filePath;
        }
      });
    }
    // 有图片生成完成时，重新获取完整数据以刷新 historyImages
    if (hasCompleted) {
      try {
        const { data: freshData } = await axios.post("/cornerScape/getAllAssets", {
          projectId: project.value?.id,
          type: checkboxValue.value,
        });
        (freshData as DataItem[]).forEach((fresh) => {
          const target = dataList.value.find((row) => row.id === fresh.id);
          if (target) target.historyImages = fresh.historyImages;
        });
        // 同步更新抽屉中的当前项
        if (currentItem.value) {
          const freshCurrent = (freshData as DataItem[]).find((d) => d.id === currentItem.value!.id);
          if (freshCurrent) currentItem.value.historyImages = freshCurrent.historyImages;
        }
      } catch (e) {
        console.error("刷新历史图片失败:", e);
      }
    }
  } catch (e) {
    console.error("轮询图片生成状态失败:", e);
  }
}
//轮询音频绑定生成
async function pollingAudioBind() {
  if (audioBindData.value.length === 0) return;
  const ids = audioBindData.value.map((item) => item.id);
  try {
    const { data } = await axios.post("/cornerScape/pollingAudio", { ids });
    let hasCompleted = false;
    if (Array.isArray(data) && data.length) {
      data.forEach((item: { id: number; audioBindState: string }) => {
        const target = dataList.value.find((row) => row.id === item.id);
        if (target) {
          if (target.audioBindState === "生成中" && item.audioBindState !== "生成中") hasCompleted = true;
          target.audioBindState = item.audioBindState;
        }
      });
    }
    if (hasCompleted) {
      try {
        const { data: freshData } = await axios.post("/cornerScape/getAllAssets", {
          projectId: project.value?.id,
          type: checkboxValue.value,
        });
        (freshData as DataItem[]).forEach((fresh) => {
          const target = dataList.value.find((row) => row.id === fresh.id);
          if (target) target.relepedAudio = fresh.relepedAudio;
        });
        // 同步更新抽屉中的当前项
        if (currentItem.value) {
          const freshCurrent = (freshData as DataItem[]).find((d) => d.id === currentItem.value!.id);
          if (freshCurrent) currentItem.value.relepedAudio = freshCurrent.relepedAudio;
        }
      } catch (e) {
        console.error("刷新历史图片失败:", e);
      }
    }
  } catch (e) {
    console.error("轮询音频绑定状态失败:", e);
  }
}
function startPolling() {
  if (pollingTimer) return;
  pollingTimer = setInterval(async () => {
    if (notCompultedData.value.length === 0) {
      stopPolling();
      return;
    }
    await pollingPromptAssets();
  }, 3000);
}

function stopPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

function startImagePolling() {
  if (imagePollingTimer) return;

  imagePollingTimer = setInterval(async () => {
    if (generatingData.value.length === 0) {
      stopImagePolling();
      return;
    }
    await pollingImageAssets();
  }, 3000);
}

function stopImagePolling() {
  if (imagePollingTimer) {
    clearInterval(imagePollingTimer);
    imagePollingTimer = null;
  }
}
function stopAudioPolling() {
  if (audioBindPollingTimer) {
    clearInterval(audioBindPollingTimer);
    audioBindPollingTimer = null;
  }
}
function startAudioPolling() {
  if (audioBindPollingTimer) return;
  audioBindPollingTimer = setInterval(async () => {
    if (audioBindData.value.length === 0) {
      stopAudioPolling();
      return;
    }
    await pollingAudioBind();
  }, 3000);
}

watch(notCompultedData, (val) => {
  if (val.length > 0) {
    startPolling();
  } else {
    stopPolling();
  }
});

watch(generatingData, (val) => {
  if (val.length > 0) {
    startImagePolling();
  } else {
    stopImagePolling();
  }
});

watch(audioBindData, (val) => {
  if (val.length > 0) {
    startAudioPolling();
  } else {
    stopAudioPolling();
  }
});
async function removeAudio(id: number) {
  editForm.relepedAudio = editForm.relepedAudio.filter((a) => a.id !== id);
  await axios.post("/cornerScape/updateAssetsAudio", {
    assetsId: editForm.assetsId,
  });
}
async function selectAudio() {
  const assets = await openAssetsSelector({
    title: $t("workbench.script.add.msg.selectAssetsTitle"),
    types: ["audio"],
    selectorMode: true,
    multiple: false,
  });
  if (assets.length) {
    editForm.relepedAudio = [{ id: assets[0].id, name: assets[0].name }];
    await axios.post("/cornerScape/updateAssetsAudio", {
      assetsId: editForm.assetsId,
      audioIds: editForm.relepedAudio.map((i) => i.id),
    });
  }
}
</script>

<style lang="scss" scoped>
.cornerScape {
  width: 100%;
  height: 100%;
  min-height: 0;
  align-items: flex-start;
  .left {
    width: clamp(280px, 24vw, 360px);
    height: 100%;
    min-height: 0;
    flex-shrink: 0;
    margin-right: 16px;
    margin-bottom: 16px;
    display: flex;
    flex-direction: column;
    .btnGap {
      gap: 8px;
      width: 100%;
      flex-wrap: wrap;
    }
    .selectedInfo {
      width: 100%;
      text-align: center;
    }
    .card {
      height: 100%;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: auto;
      :deep(.t-card__body) {
        flex: 1;
        min-height: 0;
        overflow: auto;
      }
      :deep(.t-card__footer) {
        padding: 0;
      }
    }
    .formFooter {
      padding: var(--app-space-4);
      border-top: 1px solid var(--td-component-stroke);
      background: var(--td-bg-color-container);
    }
    .flowSteps {
      display: flex;
      flex-direction: column;
      gap: var(--app-space-4);
    }
    .flowStep {
      display: flex;
      flex-direction: column;
      gap: 8px;
      .stepTitle {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 500;
        color: var(--td-text-color-secondary);
      }
      .stepActions {
        display: flex;
        flex-direction: column;
        gap: 8px;
        &.row {
          flex-direction: row;
          :deep(.t-button) {
            flex: 1;
          }
        }
      }
    }
    :deep(.t-form) {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    :deep(.t-form__item) {
      margin-bottom: 0;
    }
    :deep(.t-form__label) {
      font-size: 14px;
      color: var(--td-text-color-secondary);
    }
    .panelSection {
      padding-bottom: var(--app-space-4);
      margin-bottom: var(--app-space-4);
      border-bottom: 1px solid var(--td-component-stroke);
    }
    .row2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      width: 100%;
      :deep(.t-select),
      :deep(.t-input-number) {
        width: 100%;
        min-width: 0;
      }
    }
    .statsBar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px 10px;
      width: 100%;
      font-size: 12px;
      color: var(--td-text-color-secondary);
      .statItem {
        cursor: pointer;
        display: inline-flex;
        align-items: baseline;
        gap: 4px;
        white-space: nowrap;
        transition: color var(--app-transition);
        &:hover {
          color: var(--td-brand-color);
        }
        b {
          font-weight: 600;
          color: var(--td-text-color-primary);
          &.success {
            color: var(--td-success-color);
          }
          &.danger {
            color: var(--td-error-color);
          }
          &.warning {
            color: var(--td-warning-color);
          }
        }
      }
      .sep {
        width: 1px;
        height: 12px;
        background: var(--td-component-stroke);
      }
    }
    .taskProgress {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 6px 10px;
      margin-bottom: 12px;
      border: 1px solid var(--td-brand-color-light);
      border-radius: 8px;
      background: var(--td-bg-color-container);
      color: var(--td-brand-color);
      font-size: 14px;
    }
    .quickActions {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      width: 100%;
      :deep(.t-button) {
        width: 100%;
      }
      .span2 {
        grid-column: span 2;
      }
    }
    .filterGroup {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
  }
  .content {
    overflow: auto;
    height: 100%;
    width: 100%;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
    align-items: start;
    align-content: start;
    gap: 16px;
    .pageEmpty {
      grid-column: 1 / -1;
      min-height: 55vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .floatBar {
      grid-column: 1 / -1;
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--app-space-3);
      padding: var(--app-space-2) var(--app-space-3);
      border: 1px solid var(--td-component-stroke);
      border-radius: var(--app-radius-card);
      background: var(--td-bg-color-container);
      box-shadow: var(--td-shadow-1);
      .floatInfo {
        font-size: 14px;
        color: var(--td-text-color-secondary);
        white-space: nowrap;
      }
      .floatActions {
        display: flex;
        gap: var(--app-space-2);
        flex-wrap: wrap;
        justify-content: flex-end;
      }
    }
    .card {
      cursor: pointer;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      transition: box-shadow var(--app-transition), transform var(--app-transition), outline-color var(--app-transition);
      &:hover {
        transform: translateY(-2px);
        box-shadow: var(--td-shadow-1);
      }
      &.selected {
        outline: 2px solid var(--td-brand-color);
        outline-offset: -2px;
        box-shadow: var(--td-shadow-1);
      }
      :deep(.t-card__body) {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }
      .imageBox {
        position: relative;
        width: 100%;
        height: 160px;
        padding: 8px;
        background-color: var(--td-bg-color-secondarycontainer);
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        .selectBox {
          position: absolute;
          top: 8px;
          left: 8px;
          z-index: 10;
        }
        .cancelGeneration {
          position: absolute;
          top: 8px;
          right: 8px;
          z-index: 10;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s;
          cursor: pointer;
          font-size: 12px;
        }
        .generatingBox {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%);
          .generatingText {
            font-size: 14px;
            color: var(--td-brand-color);
            letter-spacing: 0.05em;
          }
        }
        .image {
          width: 100%;
          height: 100%;
          border-radius: 8px;
          overflow: hidden;
          :deep(.t-image__img) {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
        }
        .imageToolsWrap {
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
        }
        .quickOps {
          position: absolute;
          top: 8px;
          left: 8px;
          display: flex;
          gap: 6px;
          padding: 4px;
          border-radius: 8px;
          background: var(--td-bg-color-container);
          box-shadow: var(--td-shadow-1);
        }
        :deep(.t-empty) {
          width: 100%;
        }
      }
      &:hover {
        .imageToolsWrap {
          opacity: 1;
          pointer-events: auto;
        }
        .cancelGeneration {
          opacity: 1;
          pointer-events: auto;
        }
      }
      .infoBox {
        flex: 1;
        padding: 10px 4px 4px;
        overflow: hidden;
        cursor: pointer;
        .title {
          font-size: 14px;
          font-weight: 600;
          line-height: 1.5;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .meta {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 4px;
          .typeTag {
            flex-shrink: 0;
          }
          .stateTag {
            flex-shrink: 0;
          }
          .modelTag {
            min-width: 0;
            max-width: 100%;
            overflow: hidden;
            :deep(.t-tag__text) {
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
          }
        }
        .prompt {
          margin-top: 4px;
          font-size: 12px;
          color: var(--td-text-color-secondary);
          line-height: 1.5;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          line-clamp: 2;
          -webkit-box-orient: vertical;
        }
      }
    }
  }
}

.audioTag {
  cursor: pointer;
  &:hover {
    color: var(--td-brand-color);
  }
  &.playing {
    color: var(--td-brand-color);
    border-color: var(--td-brand-color);
  }
}
.paginationWrap {
  grid-column: 1 / -1;
  display: flex;
  justify-content: center;
  padding: 12px 0;
}
.drawerHeader {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
}
.audioList {
  margin-top: 8px;
}
.drawerImageBox {
  width: 100%;
  min-height: 120px;
  max-height: 400px;
  background-color: #f5f7fa;
  border-radius: 6px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;

  .image {
    width: 100%;
    height: auto;
    :deep(.t-image__img) {
      max-height: 400px;
      object-fit: contain;
    }
  }
  .generatingBox {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    .generatingText {
      font-size: 14px;
      color: var(--td-brand-color);
    }
  }
  .imageToolsWrap {
    opacity: 1;
    pointer-events: auto;
  }
}

.historyImageList {
  gap: 10px;
  overflow-x: auto;
  overflow-y: hidden;
  max-width: 100%;
  width: 0;
  min-width: 100%;
  flex-shrink: 1;
  padding-bottom: 4px;

  &::-webkit-scrollbar {
    height: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
}

.historyImageItem {
  border-radius: 4px;
  border: 3px solid transparent;
  cursor: pointer;
  transition: border-color 0.2s;
  flex-shrink: 0;
  overflow: hidden;

  &:hover {
    border-color: var(--td-brand-color-light);
  }
  &.selected {
    border-color: var(--td-brand-color);
  }
}

.drawerActions {
  display: flex;
  gap: 8px;
  width: 100%;
  :deep(.t-button) {
    flex: 1;
  }
}

.dubDialog {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .voiceSourceSwitch {
    width: 100%;
    display: flex;
    justify-content: stretch;

    :deep(.t-radio-button) {
      flex: 1;
      text-align: center;
    }
  }

  .voicePromptToolbar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }

  .dubRoleList {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 45vh;
    overflow: auto;
    padding-right: 4px;
  }

  .dubRole {
    border: 1px solid var(--td-component-border);
    border-radius: 8px;
    padding: 10px 12px;
    background: var(--td-bg-color-secondarycontainer);

    .dubRoleHeader {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;

      .dubRoleName {
        font-weight: 600;
        font-size: 14px;
      }
    }

    .dubRefRow {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 8px;

      .dubRefLabel {
        font-size: 12px;
        color: var(--td-text-color-secondary);
        white-space: nowrap;
      }
    }
  }

  .dialogFooter {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    border-top: 1px solid var(--td-component-border);
    padding-top: 12px;
  }
}
</style>
