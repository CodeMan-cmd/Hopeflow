<template>
  <div class="sandboxConfig">
    <t-alert theme="warning" class="topAlert" :message="$t('settings.sandbox.warning')" />

    <t-form :data="formData" label-align="top" class="sandboxForm" @submit="handleSave">
      <t-card :title="$t('settings.sandbox.engine')" :bordered="true" style="margin-top: 16px">
        <t-form-item :label="$t('settings.sandbox.engine')" name="sandboxEngine">
          <t-radio-group variant="default-filled" v-model="formData.sandboxEngine">
            <t-radio-button value="node:vm">{{ $t("settings.sandbox.engineNodeVm") }}</t-radio-button>
            <t-radio-button value="vm2">{{ $t("settings.sandbox.engineVm2") }}</t-radio-button>
          </t-radio-group>
          <template #help>{{ $t("settings.sandbox.engineHelp") }}</template>
        </t-form-item>
      </t-card>

      <t-card :title="$t('settings.sandbox.timeout')" :bordered="true" style="margin-top: 16px">
        <t-form-item :label="$t('settings.sandbox.timeout')" name="sandboxTimeout">
          <t-input-number
            auto-width
            :suffix="$t('settings.sandbox.seconds')"
            :min="1"
            :max="60"
            v-model="timeoutInSeconds"
            :allowInputOverLimit="false"
            :placeholder="$t('settings.sandbox.inputSeconds')" />
          <template #help>{{ $t("settings.sandbox.timeoutHelp") }}</template>
        </t-form-item>
      </t-card>

      <div class="actionRow f frr">
        <t-button theme="primary" type="submit" :loading="saving">{{ $t("settings.sandbox.saveConfig") }}</t-button>
      </div>
    </t-form>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import axios from "@/utils/axios";

interface SandboxConfigForm {
  sandboxEngine: "node:vm" | "vm2";
  sandboxTimeout: number; // 毫秒
}

const DEFAULT_FORM: SandboxConfigForm = {
  sandboxEngine: "node:vm",
  sandboxTimeout: 3000,
};

const formData = ref<SandboxConfigForm>({ ...DEFAULT_FORM });
const saving = ref(false);

// 超时以秒显示，存储为毫秒
const timeoutInSeconds = computed({
  get: () => Math.round((formData.value.sandboxTimeout || 3000) / 1000),
  set: (val: number | null | undefined) => {
    if (val == null || isNaN(val)) return;
    formData.value.sandboxTimeout = Math.min(60000, Math.max(100, Math.round(val * 1000)));
  },
});

async function getSandboxConfig() {
  try {
    const { data } = await axios.get("/setting/sandboxConfig/getSandbox");
    formData.value = {
      sandboxEngine: data.sandboxEngine === "vm2" ? "vm2" : "node:vm",
      sandboxTimeout: Number(data.sandboxTimeout) || 3000,
    };
  } catch (error: any) {
    window.$message.warning(error?.message);
  }
}

async function handleSave() {
  saving.value = true;
  try {
    await axios.post("/setting/sandboxConfig/sureSandbox", {
      ...formData.value,
    });
    window.$message.success($t("settings.sandbox.msg.saved"));
  } catch (error: any) {
    window.$message.warning(error?.message);
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  getSandboxConfig();
});
</script>

<style lang="scss" scoped>
.sandboxConfig {
  .topAlert {
    margin-bottom: 4px;
  }
}
</style>
