<template>
  <div class="gpuConfig">
    <t-alert theme="warning" class="topAlert" :message="$t('settings.gpu.warning')" />

    <t-form :data="formData" labelAlign="top" labelWidth="180px" class="gpuForm" @submit="handleSave">
      <t-card :title="$t('settings.gpu.desktopAccelerate')" :bordered="true" style="margin-top: 16px">
        <t-form-item label=" " name="hardwareAccelerate">
          <div class="switchRow">
            <t-switch :customValue="['1', '0']" v-model="formData.hardwareAccelerate" />
            <span class="switchDesc">{{ $t("settings.gpu.desktopAccelerateHelp") }}</span>
          </div>
          <template #help>
            <div class="helpRow">
              <span>{{ $t("settings.gpu.restartRequired") }}</span>
              <t-button size="small" variant="outline" @click="handleRestart">{{ $t("settings.gpu.restart") }}</t-button>
            </div>
          </template>
        </t-form-item>
      </t-card>

      <t-card :title="$t('settings.gpu.canvasComposite')" :bordered="true" style="margin-top: 16px">
        <t-form-item label=" " name="canvasComposite">
          <div class="switchRow">
            <t-switch :customValue="['1', '0']" v-model="formData.canvasComposite" />
            <span class="switchDesc">{{ $t("settings.gpu.canvasCompositeHelp") }}</span>
          </div>
        </t-form-item>
      </t-card>

      <t-card :title="$t('settings.gpu.gpuDetection')" :bordered="true" style="margin-top: 16px">
        <t-form-item label=" ">
          <div class="detectRow">
            <t-button size="small" variant="outline" @click="detectGpuEnv">{{ $t("settings.gpu.detect") }}</t-button>
          </div>
          <t-descriptions :items="gpuEnvItems" bordered size="small" style="margin-top: 12px" />
        </t-form-item>
      </t-card>

      <t-card :title="$t('settings.gpu.modelDevice')" :bordered="true" style="margin-top: 16px">
        <t-form-item :label="$t('settings.gpu.modelDevice')" name="modelDevice">
          <t-select v-model="formData.modelDevice" style="max-width: 320px">
            <t-option v-for="item in deviceOptions" :key="item.value" :value="item.value" :label="item.label" />
          </t-select>
          <template #help>{{ $t("settings.gpu.modelDeviceHelp") }}</template>
        </t-form-item>
      </t-card>

      <div class="actionRow f frr">
        <t-button theme="primary" type="submit" :loading="saving">{{ $t("settings.gpu.saveConfig") }}</t-button>
        <t-button theme="warning" variant="outline" :loading="saving" @click="handleRestory">{{ $t("settings.gpu.restoreDefault") }}</t-button>
      </div>
    </t-form>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { DialogPlugin } from "tdesign-vue-next";
import axios from "@/utils/axios";
import settingStore from "@/stores/setting";

const { gpuSetting } = storeToRefs(settingStore());

interface GpuConfigForm {
  hardwareAccelerate: "1" | "0";
  canvasComposite: "1" | "0";
  modelDevice: string;
}

const DEFAULT_FORM: GpuConfigForm = {
  hardwareAccelerate: "1",
  canvasComposite: "1",
  modelDevice: "cpu",
};

const formData = ref<GpuConfigForm>({ ...DEFAULT_FORM });

// 推理设备：cpu 纯 CPU；dml 使用 DirectML（Windows GPU）；auto 自动优先 GPU，失败回退 CPU（与记忆配置共用）
const deviceOptions = [
  { value: "cpu", label: "CPU" },
  { value: "dml", label: "DirectML (GPU)" },
  { value: "auto", label: "自动" },
];

const saving = ref(false);
const isElectron = /electron/i.test(navigator.userAgent);
// 记录修改前的硬件加速开关，用于判断是否需要提示重启
let prevHardwareAccelerate = "1";

// GPU 环境检测结果
const gpuEnv = ref({
  gpuModel: "",
  webgl: false,
  webgl2: false,
  webgpu: false,
  isElectron: isElectron,
});

const gpuEnvItems = computed(() => [
  { label: $t("settings.gpu.isElectron"), value: gpuEnv.value.isElectron ? "是" : "否" },
  { label: $t("settings.gpu.gpuModel"), value: gpuEnv.value.gpuModel || "-" },
  { label: $t("settings.gpu.webglSupport"), value: gpuEnv.value.webgl ? "支持" : "不支持" },
  { label: $t("settings.gpu.webgl2Support"), value: gpuEnv.value.webgl2 ? "支持" : "不支持" },
  { label: $t("settings.gpu.webgpuSupport"), value: gpuEnv.value.webgpu ? "支持" : "不支持" },
]);

async function getGpuConfig() {
  try {
    const { data } = await axios.get("/setting/gpuConfig/getGpu");
    formData.value = {
      hardwareAccelerate: data.hardwareAccelerate ?? "1",
      canvasComposite: data.canvasComposite ?? "1",
      modelDevice: data.modelDevice ?? "cpu",
    };
    prevHardwareAccelerate = formData.value.hardwareAccelerate;
  } catch (error: any) {
    window.$message.warning(error?.message);
  }
}

async function handleSave() {
  saving.value = true;
  try {
    await axios.post("/setting/gpuConfig/sureGpu", {
      ...formData.value,
    });

    // 同步 store，供全局运行时应用
    gpuSetting.value = { ...formData.value };

    window.$message.success($t("settings.gpu.msg.saved"));

    // 硬件加速开关变更需重启生效
    if (isElectron && formData.value.hardwareAccelerate !== prevHardwareAccelerate) {
      prevHardwareAccelerate = formData.value.hardwareAccelerate;
      const dialog = DialogPlugin.confirm({
        header: $t("settings.gpu.desktopAccelerate"),
        body: $t("settings.gpu.restartRequired"),
        confirmBtn: $t("settings.gpu.restart"),
        cancelBtn: $t("settings.gpu.msg.cancel"),
        onConfirm: async () => {
          dialog.hide();
          await handleRestart();
        },
      });
    }
  } catch (error: any) {
    window.$message.warning(error?.message);
  } finally {
    saving.value = false;
  }
}

async function handleRestart() {
  if (!isElectron) {
    window.$message.warning($t("settings.gpu.notElectron"));
    return;
  }
  try {
    await fetch("Hopeflow://apprestart");
  } catch (error) {
    window.$message.warning($t("settings.gpu.msg.detectFailed"));
  }
}

function handleRestory() {
  formData.value = { ...DEFAULT_FORM };
  handleSave();
}

function detectWebgl(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return "";
    const glContext = gl as WebGLRenderingContext;
    const debugInfo = glContext.getExtension("WEBGL_debug_renderer_info");
    if (debugInfo) {
      return String(glContext.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "");
    }
    return String(glContext.getParameter(glContext.RENDERER) || "");
  } catch {
    return "";
  }
}

async function detectGpuEnv() {
  try {
    gpuEnv.value.webgl = !!document.createElement("canvas").getContext("webgl");
    gpuEnv.value.webgl2 = !!document.createElement("canvas").getContext("webgl2");
    gpuEnv.value.webgpu = !!(navigator as any).gpu;

    if (isElectron) {
      // 桌面端：通过主进程获取 GPU 信息
      const res = await fetch("Hopeflow://getgpuinfo");
      const data = await res.json();
      const activeDevice = data?.gpuInfo?.gpuDevice?.active?.[0];
      gpuEnv.value.gpuModel = activeDevice?.deviceName || detectWebgl();
    } else {
      gpuEnv.value.gpuModel = detectWebgl();
    }
  } catch {
    gpuEnv.value.gpuModel = detectWebgl();
  }
}

onMounted(() => {
  getGpuConfig();
  detectGpuEnv();
});
</script>

<style lang="scss" scoped>
.gpuConfig {
  .topAlert {
    margin-bottom: 16px;
  }

  .gpuForm {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .switchRow {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .switchDesc {
    font-size: 14px;
    color: var(--td-text-color-secondary, #666);
  }

  .helpRow {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .detectRow {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .actionRow {
    & > * {
      margin-left: 16px;
    }
  }
}
</style>
