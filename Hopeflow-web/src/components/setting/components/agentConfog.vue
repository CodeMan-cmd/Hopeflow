<template>
  <div class="aiConfog" v-loading="loading">
    <div class="banner">
      <div class="content f ac jb">
        <div class="textContent ac">
          <i-good-two class="icon" theme="filled" size="24" fill="currentColor" />
          <span>{{ $t("settings.agent.bannerDesc") }}</span>
        </div>
        <div class="btnList f w">
          <t-button @click="jumpToWebsite">
            {{ $t("settings.agent.visitWebsite") }}
            <template #suffix>
              <i-share theme="outline" />
            </template>
          </t-button>
        </div>
      </div>
    </div>

    <div class="modeRadioGroup ac jb">
      <t-radio-group v-model="agentUseModeVal" variant="default-filled" @change="onUseModeChange">
        <t-radio value="0">{{ $t("settings.agent.ordinary") }}</t-radio>
        <t-radio value="1">{{ $t("settings.agent.advanced") }}</t-radio>
      </t-radio-group>
      <t-button v-if="agentUseModeVal == '1'" theme="primary" @click="batchSetting">批量设置</t-button>
    </div>

    <div v-if="agentUseModeVal === '0'" class="cardGrid">
      <t-card hoverShadow v-for="(item, index) in modelData" :key="index" class="skillCard f" @click="startConfig(item, '普通')">
        <div class="skillCardHeader">
          <div class="headerLeft">
            <t-avatar v-if="getDisplayLogo(item)" :image="getDisplayLogo(item)!" shape="round" />
            <t-avatar v-else shape="round" class="fallbackAvatar">
              {{ getFallbackText(item.name) }}
            </t-avatar>
            <span class="skillName">{{ item.name }}</span>
          </div>
          <t-tag v-if="item.model && !item.disabled" theme="primary" variant="light" size="small">{{ item.model }}</t-tag>
          <t-tag v-else-if="item.disabled" variant="light" size="small">{{ $t("settings.agent.notOpen") }}</t-tag>
          <t-tag v-else-if="!item.disabled && !item.model" theme="warning" variant="light" size="small">
            {{ $t("settings.agent.notConfigured") }}
          </t-tag>
        </div>
        <div class="skillCardBody">{{ item.desc }}</div>
      </t-card>
    </div>

    <div v-else class="cardGrid">
      <t-card hoverShadow v-for="(item, index) in advancedModelData" :key="index" class="skillCard f" @click="startConfig(item, '高级')">
        <div class="skillCardHeader">
          <div class="headerLeft">
            <t-avatar v-if="getDisplayLogo(item)" :image="getDisplayLogo(item)!" shape="round" />
            <t-avatar v-else shape="round" class="fallbackAvatar">
              {{ getFallbackText(item.name) }}
            </t-avatar>
            <div>
              <div class="skillName">{{ item.name }}</div>
            </div>
          </div>
          <t-tag v-if="item.model && !item.disabled" theme="primary" variant="light" size="small">{{ item.model }}</t-tag>
          <t-tag v-else-if="item.disabled" variant="light" size="small">{{ $t("settings.agent.notOpen") }}</t-tag>
          <t-tag v-else-if="!item.disabled && !item.model" theme="warning" variant="light" size="small">
            {{ $t("settings.agent.notConfigured") }}
          </t-tag>
        </div>
        <div class="skillCardBody jb">
          <div>{{ item.desc }}</div>
          <div>
            <t-tooltip :content="$t('settings.agent.temperatureHint')">
              <t-tag theme="primary" variant="light" size="small" style="margin-left: 5px">
                {{ $t("settings.agent.temperature") }}：{{ item.temperature }}
              </t-tag>
            </t-tooltip>
            <t-tag :theme="item.maxOutputTokens === 0 ? 'success' : 'primary'" variant="light" size="small" style="margin-left: 5px">
              {{ $t("settings.agent.maxOutputTokens") }}：{{ item.maxOutputTokens === 0 ? $t("settings.agent.auto") : item.maxOutputTokens }}
            </t-tag>
          </div>
        </div>
      </t-card>
    </div>

    <!-- 模型配置弹窗 -->
    <t-dialog
      v-model:visible="modelDataShow"
      :header="currentItem?.name + ' ' + $t('settings.agent.modelConfig')"
      width="480px"
      :on-confirm="confirmConfig"
      :confirm-btn="$t('settings.agent.confirm')"
      :cancel-btn="$t('settings.agent.cancel')">
      <div class="dialogContent">
        <t-form v-if="currentItem" label-align="top" :label-width="70">
          <t-form-item :label="$t('settings.agent.selectModel')">
            <modelSelect v-model="selectValue" v-model:label="selectLabel" type="text" />
          </t-form-item>
          <t-form-item :label="$t('settings.agent.temperature')" v-if="type == '高级'" :help="$t('settings.agent.temperatureHint')">
            <t-input-number v-model="currentItem.temperature" style="width: 100%" />
          </t-form-item>
          <t-form-item :label="$t('settings.agent.maxOutputTokens')" v-if="type == '高级'">
            <div class="maxTokenRow">
              <t-radio-group v-model="maxTokenMode" variant="default-filled" size="small">
                <t-radio-button value="auto">{{ $t("settings.agent.auto") }}</t-radio-button>
                <t-radio-button value="manual">{{ $t("settings.agent.manual") }}</t-radio-button>
              </t-radio-group>
              <t-input-number
                v-if="maxTokenMode === 'manual'"
                v-model="currentItem.maxOutputTokens"
                :min="1"
                theme="normal"
                style="flex: 1; margin-left: 12px" />
              <span v-else class="autoHint">{{ $t("settings.agent.autoHint") }}</span>
            </div>
          </t-form-item>
        </t-form>
      </div>
    </t-dialog>
    <!-- 批量高级配置弹窗 -->
    <t-dialog
      v-model:visible="batchDialogVisible"
      header="批量设置（高级）"
      width="640px"
      :on-confirm="applyBatchSettings"
      :confirm-btn="$t('settings.agent.confirm')"
      :cancel-btn="$t('settings.agent.cancel')"
      :loading="batchLoading">
      <div class="dialogContent">
        <t-form label-align="top">
          <t-form-item label="选择agent">
            <t-select multiple v-model="batchSelectedRaw" @change="onBatchAgentsChange" placeholder="请选择">
              <t-option :value="'全部'">全部</t-option>
              <t-option v-for="item in advancedModelData" :key="item.id" :value="item.id" :label="item.name">{{ item.name }}</t-option>
            </t-select>
          </t-form-item>
          <t-form-item :label="$t('settings.agent.selectModel')">
            <modelSelect v-model="batchGlobalModel" v-model:label="batchGlobalLabel" type="text" />
          </t-form-item>
          <t-form-item :label="$t('settings.agent.temperature')" :help="$t('settings.agent.temperatureHint')">
            <t-input-number v-model="batchSettings.temperature" style="width: 100%" />
          </t-form-item>
          <t-form-item :label="$t('settings.agent.maxOutputTokens')">
            <div class="maxTokenRow">
              <t-radio-group v-model="batchMaxTokenMode" variant="default-filled" size="small">
                <t-radio-button value="auto">{{ $t("settings.agent.auto") }}</t-radio-button>
                <t-radio-button value="manual">{{ $t("settings.agent.manual") }}</t-radio-button>
              </t-radio-group>
              <t-input-number
                v-if="batchMaxTokenMode === 'manual'"
                v-model="batchSettings.maxOutputTokens"
                :min="1"
                theme="normal"
                style="flex: 1; margin-left: 12px" />
              <span v-else class="autoHint">{{ $t("settings.agent.autoHint") }}</span>
            </div>
          </t-form-item>
        </t-form>
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import modelSelect from "@/components/modelSelect.vue";
import { providersLogo, modelProviderRules } from "@/utils/providersLogo";
import axios from "@/utils/axios";
import settingStore from "@/stores/setting";
const { isElectron } = storeToRefs(settingStore());

interface ModelType {
  id: number;
  model: string;
  modelName: string;
  vendorId: number | null;
  name: string;
  icon: string;
  desc: string;
  disabled?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
}

const modelData = ref<ModelType[]>([]);

const modelDataShow = ref(false);
const currentItem = ref<ModelType | null>(null);
const selectValue = ref<string>("");
const selectLabel = ref<string>("");

function getProviderLogo(manufacturer: string) {
  if (!manufacturer) return null;
  const key = Object.keys(providersLogo).find((k) => k.toLowerCase() === manufacturer.toLowerCase());
  return key ? providersLogo[key as keyof typeof providersLogo] : null;
}

function inferProviderByModel(modelName?: string, model?: string) {
  const source = `${modelName || ""} ${model || ""}`.trim();
  if (!source) return null;
  const matchedRule = modelProviderRules.find((rule: { pattern: RegExp }) => rule.pattern.test(source));
  return matchedRule ? providersLogo[matchedRule.provider] : null;
}

function getDisplayLogo(item: ModelType) {
  return getProviderLogo(item.icon) || inferProviderByModel(item.modelName, item.model);
}

function getFallbackText(name: string) {
  return name?.slice(0, 1) || "A";
}
const type = ref("");
const maxTokenMode = ref<"auto" | "manual">("auto");

watch(maxTokenMode, (val) => {
  if (val === "auto" && currentItem.value) {
    currentItem.value.maxOutputTokens = 0;
  }
  if (val === "manual" && currentItem.value && (currentItem.value.maxOutputTokens === 0 || currentItem.value.maxOutputTokens == null)) {
    currentItem.value.maxOutputTokens = 8192;
  }
});

function startConfig(item: ModelType, source: string) {
  if (item.disabled) return window.$message.warning($t("settings.agent.msg.notAvailable"));
  currentItem.value = item;
  selectValue.value = item.modelName || "";
  selectLabel.value = item.model || "";
  maxTokenMode.value = item.maxOutputTokens === 0 || item.maxOutputTokens == null ? "auto" : "manual";
  modelDataShow.value = true;
  type.value = source;
}

const currentVendorId = ref<number | null>(null);
function confirmConfig() {
  if (currentItem.value) {
    currentItem.value.model = selectLabel.value;
    currentItem.value.modelName = selectValue.value;
    currentItem.value.vendorId = currentVendorId.value;
  }
  const data = {
    id: currentItem.value?.id,
    name: currentItem.value?.name,
    model: selectLabel.value || selectValue.value.split(/:(.+)/)[1] || currentItem.value?.model,
    modelName: currentItem.value?.modelName,
    vendorId: selectValue.value.split(/:(.+)/)[0],
    desc: currentItem.value?.desc,
    temperature: currentItem.value?.temperature ?? 1,
    maxOutputTokens: currentItem.value?.maxOutputTokens ?? 0,
  };
  axios
    .post("/setting/agentDeploy/updateAgentModel", data)
    .then(() => {
      window.$message.success($t("settings.agent.msg.configSuccess"));
      getAgentDeploy();
    })
    .catch((err: { message?: string }) => {
      window.$message.error(`${$t("settings.agent.msg.updateConfigFailed")}${err.message}`);
    })
    .finally(() => {
      modelDataShow.value = false;
    });
}
const loading = ref(false);

//查询Agent配置列表
function getAgentDeploy() {
  axios
    .post("/setting/agentDeploy/getAgentDeploy")
    .then((res: any) => {
      modelData.value = res.data.qrdinaryData;
      advancedModelData.value = res.data.advancedData;
    })
    .catch((err: { message?: string }) => {
      window.$message.error(`${$t("settings.agent.msg.getAgentListFailed")}${err.message}`);
    })
    .finally(() => {});
}
onMounted(() => {
  getAgentDeploy();
});

// ── 供应商列表 ──
interface VendorItem {
  id: string; //供应商唯一标识，必须全局唯一
  inputValues: Record<string, string>;
}

const vendorList = ref<VendorItem[]>([]);

async function getVendorList() {
  try {
    const res = await axios.post("/setting/vendorConfig/getVendorList");
    vendorList.value = res.data.map((item: any) => {
      return {
        ...item,
        enable: item.enable == 1 ? true : false,
      };
    });
  } catch (err: any) {
    window.$message.error(`${$t("settings.vendor.msg.getVendorListFailed")}${err.message}`);
  }
}
//高级配置
const advancedModelData = ref<ModelType[]>([]);
const agentUseModeVal = ref("0");

// 批量设置状态
const batchDialogVisible = ref(false);
const batchSelectedIds = ref<number[]>([]);
const batchApplyToAll = ref(false);
const batchSelectedRaw = ref<(number | string)[]>([]);
const batchModelValues = reactive<any>({});
const batchModelLabels = reactive<any>({});
const batchGlobalModel = ref<string>("");
const batchGlobalLabel = ref<string>("");
const batchSettings = ref({ temperature: 1, maxOutputTokens: 0 });
const batchMaxTokenMode = ref<"auto" | "manual">("auto");
const batchLoading = ref(false);

watch(batchMaxTokenMode, (val) => {
  if (val === "auto") {
    batchSettings.value.maxOutputTokens = 0;
  }
  if (val === "manual" && (batchSettings.value.maxOutputTokens === 0 || batchSettings.value.maxOutputTokens == null)) {
    batchSettings.value.maxOutputTokens = 8192;
  }
});

watch(batchApplyToAll, (val) => {
  if (val) batchSelectedIds.value = [];
});

function onBatchAgentsChange(value: any) {
  const val: Array<number | string> = Array.isArray(value) ? value : value == null ? [] : [value];
  if (!val || val.length === 0) {
    batchSelectedIds.value = [];
    batchApplyToAll.value = false;
    return;
  }
  if (val.includes("全部")) {
    batchApplyToAll.value = true;
    batchSelectedIds.value = advancedModelData.value.map((m) => m.id);
    // show only ALL in UI
    batchSelectedRaw.value = ["全部"];
  } else {
    batchApplyToAll.value = false;
    batchSelectedIds.value = val.filter((v) => v !== "全部").map((v) => Number(v));
  }
}

async function applyBatchSettings() {
  const targetIds = batchApplyToAll.value ? advancedModelData.value.map((m) => m.id) : batchSelectedIds.value;
  if (!targetIds || targetIds.length === 0) {
    return window.$message.warning("请选择要设置的模型");
  }
  batchLoading.value = true;
  const items = targetIds
    .map((id) => {
      const item = advancedModelData.value.find((m) => m.id === id);
      if (!item) return null;
      // use the batch-global model select value for all selected agents
      const selectedValue = batchGlobalModel.value || item.modelName;
      const selectedLabel = batchGlobalLabel.value || item.model;
      const vendorId = selectedValue ? String(selectedValue).split(/:(.+)/)[0] : ((item.vendorId as any) ?? "");
      const modelVal = selectedLabel || (selectedValue ? String(selectedValue).split(/:(.+)/)[1] : "") || item.model;
      return {
        id: item.id,
        name: item.name,
        model: modelVal,
        modelName: selectedValue || item.modelName,
        vendorId: vendorId,
        desc: item.desc,
        temperature: batchSettings.value.temperature ?? 1,
        maxOutputTokens: batchMaxTokenMode.value === "auto" ? 0 : (batchSettings.value.maxOutputTokens ?? 0),
      };
    })
    .filter(Boolean);
  try {
    await axios.post("/setting/agentDeploy/deployAgentModel", { items });
    window.$message.success($t("settings.agent.msg.configSuccess"));
    getAgentDeploy();
    batchDialogVisible.value = false;
  } catch (err: any) {
    window.$message.error(`${$t("settings.agent.msg.updateConfigFailed")}${err.message ?? ""}`);
  } finally {
    batchLoading.value = false;
  }
}

async function getUseModeVal() {
  const { data } = await axios.get("/setting/agentDeploy/getAgentUseMode");
  agentUseModeVal.value = data;
}
async function updateUseMode(val: string) {
  await axios.post("/setting/agentDeploy/updateUseMode", {
    agentUseMode: val,
  });
}
function onUseModeChange(val: any) {
  // wrapper to avoid returning Promise from template handler
  updateUseMode(String(val));
}

function batchSetting() {
  batchSelectedIds.value = [];
  batchApplyToAll.value = false;
  batchSelectedRaw.value = [];
  if (advancedModelData.value && advancedModelData.value.length) {
    const first = advancedModelData.value[0];
    batchSettings.value.temperature = first.temperature ?? 1;
    batchSettings.value.maxOutputTokens = first.maxOutputTokens ?? 0;
    batchMaxTokenMode.value = batchSettings.value.maxOutputTokens === 0 ? "auto" : "manual";
    // 初始化每个模型的选择值
    advancedModelData.value.forEach((it) => {
      batchModelValues[it.id] = it.modelName ?? "";
      batchModelLabels[it.id] = it.model ?? "";
    });
    batchGlobalModel.value = first.modelName ?? "";
    batchGlobalLabel.value = first.model ?? "";
  } else {
    batchSettings.value.temperature = 1;
    batchSettings.value.maxOutputTokens = 0;
    batchMaxTokenMode.value = "auto";
  }
  batchDialogVisible.value = true;
}

onMounted(() => {
  getUseModeVal();
});

//跳转官方网站
async function jumpToWebsite() {
  if (isElectron.value) {
    await fetch(`Hopeflow://openurlwithbrowser?url=https://platform.deepseek.com`);
  } else {
    window.open("https://platform.deepseek.com", "_blank");
  }
}
</script>

<style lang="scss" scoped>
.aiConfog {
  display: flex;
  flex-direction: column;
  .banner {
    background-color: var(--td-success-color-focus);
    padding: 16px;
    margin-bottom: 16px;
    border-radius: 4px;
    .content {
      width: 100%;
      .icon {
        color: var(--td-success-color);
        margin-right: 0.5em;
      }
      .btnList {
        .rightBtnList {
          & > * {
            margin-left: 0.5em;
          }
        }
      }
    }
  }
}

.modeRadioGroup {
  margin-bottom: 16px;
}

.cardGrid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-top: 5px;
}

.skillCard {
  cursor: pointer;
  padding: 4px;
  display: flex;
  flex-direction: column;
}

.skillCardHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  .headerLeft {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .skillName {
    font-size: 16px;
    font-weight: 600;
  }
  .fallbackAvatar {
    background: var(--td-brand-color-light);
    color: var(--td-brand-color);
    font-size: 14px;
    font-weight: 600;
  }
}

.skillCardBody {
  font-size: 14px;
  color: var(--td-text-color-secondary);
  line-height: 1.5;
}

.dialogContent {
  padding: 8px 0;
}

.maxTokenRow {
  display: flex;
  align-items: center;
  width: 100%;

  .autoHint {
    flex: 1;
    margin-left: 12px;
    font-size: 14px;
    color: var(--td-text-color-placeholder);
  }
}

.batchModels {
  max-height: 240px;
  overflow: auto;
}
.batchModelItem {
  padding: 6px 0;
}
.batchModelRow {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
<style lang="scss">
.t-select-option {
  display: block !important;
}
</style>
