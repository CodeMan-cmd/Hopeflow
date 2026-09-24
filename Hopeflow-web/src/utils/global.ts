import { MessagePlugin } from "tdesign-vue-next";

import i18n from "@/locales";
const { t } = i18n.global;

declare global {
  interface Window {
    $message: typeof MessagePlugin;
    $port: string;
    $t: typeof t;
  }
}

window.$message = MessagePlugin;

window.$t = t;

// 禁止页面原生缩放（不影响画布 VueFlow 自身的 JS 缩放）
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && ["=", "+", "-", "0"].includes(e.key)) {
    e.preventDefault();
  }
});

document.addEventListener(
  "wheel",
  (e) => {
    if (e.ctrlKey || e.metaKey) e.preventDefault();
  },
  { passive: false },
);

document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("gesturechange", (e) => e.preventDefault());
document.addEventListener("gestureend", (e) => e.preventDefault());
