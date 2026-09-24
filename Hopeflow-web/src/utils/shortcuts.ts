import { useEventListener } from "@vueuse/core";

export type ShortcutHandlers = {
  save?: () => void;
  commandPalette?: () => void;
  resetZoom?: () => void;
  fitView?: () => void;
};

// 判断事件目标是否为输入类元素，避免在输入时误触快捷键
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/**
 * 全局/页面级快捷键注册
 * - Cmd/Ctrl + S：保存当前页（通过自定义事件 app:save 通知页面自身处理）
 * - Cmd/Ctrl + K：打开命令面板
 * - 0：生产画布缩放复位；F：画布自适应（仅画布页使用）
 */
export function useShortcuts(handlers: ShortcutHandlers, enabled: () => boolean = () => true) {
  useEventListener(document, "keydown", (e: KeyboardEvent) => {
    if (!enabled()) return;
    if (isEditableTarget(e.target)) return;
    const mod = e.metaKey || e.ctrlKey;

    if (mod && e.key.toLowerCase() === "s") {
      e.preventDefault();
      handlers.save?.();
      return;
    }
    if (mod && e.key.toLowerCase() === "k") {
      e.preventDefault();
      handlers.commandPalette?.();
      return;
    }
    if (e.key === "0") {
      handlers.resetZoom?.();
      return;
    }
    if (e.key.toLowerCase() === "f" && !mod) {
      handlers.fitView?.();
    }
  });
}

// 全局保存事件：页面在需要时监听并执行各自的保存逻辑
export function dispatchSaveEvent() {
  window.dispatchEvent(new CustomEvent("app:save"));
}
