<template>
  <div class="titleBar" :class="{ 'is-mac': isMac, 'is-fullscreen': isFullScreen }">
    <!-- Windows/Linux 自定义窗口按钮；macOS 由系统原生红绿灯接管 -->
    <div v-if="!isMac" class="titleBar-controls">
      <div class="titleBar-btn" @click="handleMinimize">
        <i-round theme="filled" size="13" fill="#febc2e" />
      </div>
      <div class="titleBar-btn" @click="handleMaximize">
        <i-round theme="filled" size="13" fill="#28c840" />
      </div>
      <div class="titleBar-btn" @click="handleClose">
        <i-round theme="filled" size="13" fill="#ff5f57" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const isMaximized = ref(false);
const isFullScreen = ref(false);
// macOS 由系统原生红绿灯接管窗口操作
const isMac = /macintosh|mac os/i.test(navigator.userAgent);

async function electronAction(action: string) {
  try {
    const res = await fetch(`Hopeflow://${action}`);
    return await res.json();
  } catch {
    // 非 Electron 环境或请求失败
  }
}

function handleMinimize() {
  electronAction("windowMinimize");
}

function handleMaximize() {
  electronAction("windowMaximize");
  isMaximized.value = !isMaximized.value;
}

function handleClose() {
  electronAction("windowClose");
}

async function syncMaximizedState() {
  try {
    const res = await fetch("Hopeflow://windowIsMaximized");
    const data = await res.json();
    if (data && typeof data.maximized === "boolean") {
      isMaximized.value = data.maximized;
    }
  } catch {
    // 忽略
  }
}

// 同步全屏状态：macOS 全屏时红绿灯隐藏、窗口不可拖拽，titleBar 需整体隐藏避免占用顶部空间
async function syncFullScreenState() {
  try {
    const res = await fetch("Hopeflow://windowIsFullScreen");
    const data = await res.json();
    if (data && typeof data.fullscreen === "boolean") {
      isFullScreen.value = data.fullscreen;
    }
  } catch {
    // 非 Electron 环境，保持显示
    isFullScreen.value = false;
  }
}

onMounted(() => {
  syncMaximizedState();
  syncFullScreenState();
  window.addEventListener("resize", syncMaximizedState);
  window.addEventListener("resize", syncFullScreenState);
});

onUnmounted(() => {
  window.removeEventListener("resize", syncMaximizedState);
  window.removeEventListener("resize", syncFullScreenState);
});
</script>

<style lang="scss" scoped>
.titleBar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: 32px;
  background-color: var(--td-bg-color-secondarycontainer);
  user-select: none;
  -webkit-app-region: drag;
  position: relative;
  z-index: 9999;
  width: 100%;
}

// macOS：窗口操作由系统红绿灯接管，此条仅作拖拽区与顶部占位，背景透明融入页面
.titleBar.is-mac {
  background-color: transparent;
}

// 全屏（macOS 绿点/快捷键进入原生全屏）时红绿灯隐藏、窗口不可拖拽，titleBar 完全无用，隐藏让内容铺满
.titleBar.is-fullscreen {
  display: none;
}

.titleBar-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 13px;
  height: 100%;
  -webkit-app-region: no-drag;
}

.titleBar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity 0.15s;
  line-height: 0;

  &:hover {
    opacity: 0.8;
  }

  &:active {
    opacity: 0.6;
  }
}
</style>
