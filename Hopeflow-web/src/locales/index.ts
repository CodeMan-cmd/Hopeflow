import { createI18n } from "vue-i18n";
import { useLocalStorage } from "@vueuse/core";
import zhCN from "./language/zh-CN.json";
import en from "./language/en.json";

const languageList = [
  { label: "简体中文", tips: "Chinese (Simplified)", value: "zh-CN" },
  { label: "繁體中文", tips: "Chinese (Traditional)", value: "zh-TW" },
  { label: "English", tips: "English", value: "en" },
  { label: "ไทย", tips: "Thai", value: "th-TH" },
  { label: "Tiếng Việt", tips: "Vietnamese", value: "vi-VN" },
  { label: "日本語", tips: "Japanese", value: "ja-JP" },
  { label: "Русский", tips: "Russian", value: "ru-RU" },
];

const cachedLocale = useLocalStorage("locale", "zh-CN");

// 默认语言(zh-CN)与兜底语言(en)在入口同步加载，其余语言切换时动态拉取，减小首屏包体
const i18n = createI18n({
  legacy: false,
  locale: cachedLocale.value,
  fallbackLocale: "en",
  messages: {
    "zh-CN": zhCN,
    en,
  },
});

const LAZY_LOCALES: Record<string, () => Promise<Record<string, unknown>>> = {
  "zh-TW": () => import("./language/zh-TW.json"),
  "th-TH": () => import("./language/th_TH.json"),
  "vi-VN": () => import("./language/vi-VN.json"),
  "ja-JP": () => import("./language/ja_JP.json"),
  "ru-RU": () => import("./language/ru_RU.json"),
};

// 按需加载语言包（幂等：已加载则直接返回）
async function loadLocale(lang: string): Promise<void> {
  const load = LAZY_LOCALES[lang];
  if (!load || i18n.global.te(lang)) return;
  const messages = await load();
  i18n.global.setLocaleMessage(lang, messages as Record<string, unknown>);
}

// 若持久化的语言是非默认语言，启动时静默预载，避免显示为兜底语言
if (cachedLocale.value !== "zh-CN" && cachedLocale.value !== "en") {
  void loadLocale(cachedLocale.value);
}

export { languageList, cachedLocale, loadLocale };
export default i18n;
