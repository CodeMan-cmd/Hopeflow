<template>
  <div class="requestConfig">
    <t-alert style="margin-bottom: 16px" theme="warning" :message="$t('settings.request.warning')"></t-alert>
    <t-form :data="formData" labelAlign="top" :rules="formRules">
      <t-form-item :label="$t('settings.request.apiAddress')" name="baseUrl">
        <t-input v-model="formData.baseUrl" :placeholder="$t('settings.request.apiPlaceholder')" clearable>
          <template #prefix-icon>
            <t-icon name="link" />
          </template>
        </t-input>
      </t-form-item>
      <t-form-item>
        <t-space size="small">
          <t-button theme="primary" type="submit" @click="handleSubmit">{{ $t("settings.request.save") }}</t-button>
          <t-button theme="default" @click="handleReset">{{ $t("settings.request.reset") }}</t-button>
          <t-button v-if="isElectron" theme="warning" @click="refreshAPI">{{ $t("settings.request.refresh") }}</t-button>
        </t-space>
      </t-form-item>
    </t-form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { type FormRules } from "tdesign-vue-next";
import settingStore from "@/stores/setting";
const { baseUrl, isElectron } = storeToRefs(settingStore());

interface RequestForm {
  baseUrl: string;
}

const formData = ref<RequestForm>({
  baseUrl: "",
});

const formRules: FormRules<RequestForm> = {
  baseUrl: [
    { required: true, message: $t("settings.request.msg.enterApi"), trigger: "blur" },
    {
      pattern: /^(https?:\/\/.+|\/.+)/,
      message: $t("settings.request.msg.validUrl"),
      trigger: "blur",
    },
  ],
};

function loadSettings() {
  formData.value.baseUrl = baseUrl.value;
}

async function handleSubmit() {
  let url = formData.value.baseUrl.trim();
  // 桌面端相对路径（如 /api）自动补全为后端绝对地址，保证 file:// 页面可访问
  if (isElectron.value && /^\//.test(url)) {
    try {
      const res = await fetch("Hopeflow://getAppUrl");
      const data = await res.json();
      const base = (data?.url || "http://localhost:10588/api").replace(/\/+$/, "");
      url = base + url;
    } catch (error) {
      // 获取失败时保持原值
    }
  }
  baseUrl.value = url;
  formData.value.baseUrl = url;
  window.$message.success($t("settings.request.msg.saved"));
}

async function handleReset() {
  formData.value.baseUrl = "/api";
  // 桌面端同样补全为绝对地址
  if (isElectron.value) {
    try {
      const res = await fetch("Hopeflow://getAppUrl");
      const data = await res.json();
      const base = (data?.url || "http://localhost:10588/api").replace(/\/+$/, "");
      formData.value.baseUrl = base + "/api";
    } catch (error) {
      // 获取失败时保持 /api
    }
  }
  baseUrl.value = formData.value.baseUrl;
  window.$message.success($t("settings.request.msg.reset"));
}

async function refreshAPI() {
  try {
    const res = await fetch("Hopeflow://getAppUrl");
    const data = await res.json();
    if (data?.url) {
      baseUrl.value = data.url;
      formData.value.baseUrl = data.url;
      isElectron.value = true;
      window.$message.success($t("settings.request.msg.refreshSuccess"));
    } else {
      window.$message.error($t("settings.request.msg.refreshFailed"));
    }
  } catch (error) {
    window.$message.error($t("settings.request.msg.refreshFailed"));
  }
}

onMounted(() => {
  loadSettings();
});
</script>

<style lang="scss" scoped></style>
