<template>
  <div class="loginPage" :style="{ height: isElectron ? 'calc(100vh - 32px)' : '100vh' }">
    <div class="formBox">
      <!-- 设置弹窗 -->
      <t-dialog v-model:visible="showSettingModal" :header="$t('login.settings')" @confirm="handleSaveSetting" :width="400">
        <t-form label-width="80px" labelAlign="top">
          <t-form-item :label="$t('login.requestAddress')">
            <t-input v-model="tempBaseUrl" :placeholder="$t('login.requestAddressPlaceholder')" />
          </t-form-item>
          <t-alert v-if="isElectron" theme="warning" :message="$t('login.requestAddressElectronTip')" style="margin-bottom: 4px" />
          <t-form-item v-if="isElectron">
            <t-button theme="primary" variant="outline" size="small" @click="handleAutoDetect" :loading="autoDetecting">
              <template #icon><i-refresh :size="14" /></template>
              {{ $t("login.autoDetect") }}
            </t-button>
          </t-form-item>
        </t-form>
      </t-dialog>
      <div class="logoBox fc">
        <div class="logoImg"></div>
        <div class="fc c">
          <span class="logoText">Hopeflow</span>
          <span class="slogan">{{ $t("login.slogan") }}</span>
        </div>
      </div>
      <div class="login-form">
        <t-input v-model="state.user.username" :placeholder="$t('login.username')" autocomplete="username" size="large"></t-input>
        <t-input v-model="state.user.password" type="password" :placeholder="$t('login.password')" size="large"></t-input>
        <t-button class="loginBtn" theme="primary" size="large" :loading="state.loginLoading" @click="handleLogin" block>
          {{ $t("login.login") }}
        </t-button>
      </div>
      <div class="tips c">{{ $t("login.tips") }}</div>
    </div>
  </div>
  <div class="settingBtn">
    <t-dropdown :options="langOptions" trigger="click" @click="handleChangeLang" :maxColumnWidth="150">
      <t-button shape="circle" theme="default" size="large">
        <template #icon>
          <i-translate theme="outline" size="20" />
        </template>
      </t-button>
    </t-dropdown>
    <t-button shape="circle" theme="primary" size="large" @click="showSettingModal = true">
      <template #icon>
        <i-setting-two theme="outline" size="20" />
      </template>
    </t-button>
  </div>
</template>

<script setup>
import { useI18n } from "vue-i18n";
import Router from "@/router/index.ts";
import logo from "@/assets/logo.png";
import axios from "@/utils/axios";
import settingStore from "@/stores/setting";
import { storeToRefs } from "pinia";
import { languageList, cachedLocale, loadLocale } from "@/locales";

const { locale } = useI18n();
const langOptions = languageList.map((item) => ({
  content: item.label,
  value: item.value,
}));
const handleChangeLang = async (data) => {
  await loadLocale(data.value);
  locale.value = data.value;
  cachedLocale.value = data.value;
};

const store = settingStore();
const { baseUrl, isElectron } = storeToRefs(store);

const showSettingModal = ref(false);
const tempBaseUrl = ref(baseUrl.value);
const autoDetecting = ref(false);

// 桌面端自动检测后端实际地址（生产版端口随机分配，不能写死）
async function handleAutoDetect() {
  autoDetecting.value = true;
  try {
    const res = await fetch("Hopeflow://getAppUrl");
    const data = await res.json();
    if (data?.url) {
      tempBaseUrl.value = data.url;
    } else {
      window.$message.warning($t("login.autoDetectFailed"));
    }
  } catch (error) {
    window.$message.error($t("login.autoDetectFailed"));
  } finally {
    autoDetecting.value = false;
  }
}

// 保存设置：桌面端相对路径（如 /api）自动补全为后端绝对地址，保证 file:// 页面可访问
const handleSaveSetting = async () => {
  let url = tempBaseUrl.value.trim();
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
  showSettingModal.value = false;
  window.$message.success($t("login.settingsSaved"));
};
const state = ref({
  show: true,
  loginLoading: false,
  user: {
    username: "",
    password: "",
  },
  rules: {
    username: [{ required: true, message: $t("login.usernameRequired") }],
    password: [{ required: true, message: $t("login.passwordRequired") }],
  },
});

const handleLogin = () => {
  if (!state.value.user.username || !state.value.user.password) {
    window.$message.warning($t("login.enterUsernameAndPassword"));
    return;
  }
  state.value.loginLoading = true;
  const obj = { ...state.value.user };
  axios
    .post("/login/login", obj, { silent: true })
    .then(({ data }) => {
      localStorage.setItem("token", data.token);
      localStorage.setItem("userId", data.id);
      Router.push("/project");
      window.$message.success($t("login.loginSuccess"));
      state.value.loginLoading = false;
    })
    .catch((e) => {
      state.value.loginLoading = false;
      window.$message.error(e.message);
    });
};
</script>

<style lang="scss" scoped>
.loginPage {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  // 柔和品牌色径向渐变，暗色模式下使用品牌浅色几乎不可见、不刺眼
  background:
    radial-gradient(1200px 600px at 15% 10%, var(--td-brand-color-light), transparent 60%),
    radial-gradient(1000px 500px at 85% 90%, var(--td-brand-color-light-hover), transparent 60%),
    var(--bgc);

  .formBox {
    width: 380px;
    padding: 40px 40px 30px;
    background: var(--td-bg-color-container);
    border-radius: 16px;
    box-shadow: var(--td-shadow-3);

    .logoBox {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 30px;
      gap: 12px;

      .logoImg {
        width: 64px;
        height: 64px;
        background-color: var(--td-text-color-primary);
        mask: url("@/assets/logo-mask.svg") no-repeat center;
        mask-size: contain;
        -webkit-mask: url("@/assets/logo-mask.svg") no-repeat center;
        -webkit-mask-size: contain;
      }

      .logoText {
        font-size: 36px;
        font-weight: 800;
        color: var(--td-text-color-primary);
        letter-spacing: 1px;
      }
      .slogan {
        opacity: 0.5;
        white-space: nowrap;
      }
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 20px;

      .input-icon {
        color: var(--td-text-color-placeholder);
        font-size: 18px;
      }

      :deep(.t-input) {
        border-radius: 8px;
      }
    }
  }
  .tips {
    opacity: 0.5;
    font-size: 12px;
    margin-top: 18px;
  }
}

.default-hint {
  margin-top: 20px;
  border-radius: 8px;

  :deep(.t-alert__message) {
    width: 100%;
  }

  .hint-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 14px;
    color: #666;

    p {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }

  code {
    background: var(--td-bg-color-container);
    padding: 2px 10px;
    border-radius: 4px;
    font-family: "Monaco", "Menlo", monospace;
    font-weight: 500;
    font-size: 14px;
    border: 1px solid var(--td-component-border);
  }
}

.settingBtn {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
