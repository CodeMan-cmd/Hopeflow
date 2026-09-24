import axios, { type InternalAxiosRequestConfig } from "axios";
import router from "@/router/index";
import { storeToRefs } from "pinia";
import { MessagePlugin, NotifyPlugin } from "tdesign-vue-next";
import settingStore from "@/stores/setting";
import { h } from "vue";

// 扩展请求配置：silent 跳过统一错误提示；retry 启用网络错误重试
declare module "axios" {
  export interface AxiosRequestConfig {
    silent?: boolean;
    retry?: boolean;
  }
}

const instance = axios.create();

instance.interceptors.request.use(function (config) {
  const { baseUrl, otherSetting } = storeToRefs(settingStore());
  config.baseURL = baseUrl.value;
  config.timeout = otherSetting.value.axiosTimeOut;
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = token;
  }

  return config;
});

const MAX_RETRY = 2;

instance.interceptors.response.use(
  function (response) {
    return response.data;
  },
  async function (error) {
    const config = (error?.config || {}) as InternalAxiosRequestConfig & { __retryCount?: number };
    const isNetworkError =
      String(error?.message || "").includes("Network Error") || error?.response?.data?.message === "Network Error";

    if (error?.status === 401 || error?.response?.status === 401) {
      localStorage.removeItem("token");
      router.push("/login");
      MessagePlugin.error(window.$t("common.sessionExpired"));
    }

    // 幂等/轮询请求网络错误时指数退避重试（config.retry = true 启用）
    if (isNetworkError && config.retry && (config.__retryCount || 0) < MAX_RETRY) {
      const count = config.__retryCount || 0;
      config.__retryCount = count + 1;
      const delay = 500 * Math.pow(2, count);
      await new Promise((r) => setTimeout(r, delay));
      return instance.request(config);
    }

    if (isNetworkError) {
      NotifyPlugin.error({
        title: "Network Error",
        closeBtn: true,
        duration: 3000, // 不自动关闭，让用户有时间看
        className: "customNotifyFull", // 自定义类名
        content: () =>
          h("div", [
            h("div", { style: { marginBottom: "4px" } }, "网络连接失败，请依次尝试："),
            h("div", { style: { marginBottom: "4px" } }, "1. 右键程序图标 → 以管理员身份运行"),
            h("div", "2. 检查后端服务是否已正常启动"),
          ]),
      });
    }

    // 统一业务错误提示：页面可传 { silent: true } 跳过（自行处理错误提示）
    if (!config.silent) {
      const msg = error?.response?.data?.message || error?.message;
      if (msg && msg !== "Network Error") {
        MessagePlugin.error(typeof msg === "string" ? msg : "请求失败");
      }
    }

    return Promise.reject(error?.response?.data ?? error);
  },
);

export default instance;
