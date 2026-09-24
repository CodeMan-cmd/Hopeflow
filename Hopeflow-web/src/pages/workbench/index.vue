<template>
  <div class="main" :style="{ height: isElectron ? 'calc(100vh - 32px)' : '100vh' }">
    <div class="menu fc jb" :class="{ 'is-expanded': menuExpanded }">
      <div class="logoBox c" @click="router.push('/project')" style="cursor: pointer">
        <div class="logo"></div>
        <span class="logoText" v-if="menuExpanded">Hopeflow</span>
      </div>
      <div class="itemBox fc ac">
        <t-tooltip
          :content="menu.labelKey ? $t(menu.labelKey) : ''"
          placement="right"
          destroyOnClose
          :showArrow="false"
          :disabled="menuExpanded"
          v-for="(menu, index) in menuList"
          :key="index">
          <div class="item f c" v-if="menu.type === 'btn'" :class="{ active: activeMenu == menu.path }" @click="handleClick(menu)">
            <component :is="menu.icon" class="icon" />
            <span class="menuLabel" v-if="menuExpanded">{{ menu.labelKey ? $t(menu.labelKey) : "" }}</span>
          </div>
          <div class="divider" v-if="menu.type === 'divider'"></div>
        </t-tooltip>
      </div>
      <div class="footItem fc ac">
        <div class="item f c" @click="menuExpanded = !menuExpanded">
          <component :is="menuExpanded ? 'i-menu-fold-one' : 'i-menu-unfold-one'" class="icon" />
          <span class="menuLabel" v-if="menuExpanded">{{ $t("workbench.collapse") }}</span>
        </div>
        <t-tooltip :content="$t('workbench.menu.settings')" placement="right" destroyOnClose :showArrow="false" :disabled="menuExpanded">
          <div class="item f c" @click="showSetting = true">
            <t-badge :count="needUpdate ? 1 : 0" dot>
              <i-setting-one class="icon" />
            </t-badge>
            <span class="menuLabel" v-if="menuExpanded">{{ $t("workbench.menu.settings") }}</span>
          </div>
        </t-tooltip>
      </div>
    </div>
    <div class="view">
      <div class="topMenu f ac jb">
        <div class="title f ac" style="gap: 10px; min-width: 0">
          <h2 class="titleText">{{ project?.name || $t("workbench.selectProject") }}</h2>
        </div>
        <div class="rightBtnList f ac" v-if="project?.id">
          <template v-for="(menu, index) in flowMenus" :key="menu.path">
            <div class="moduleTab f ac" :class="{ active: activeMenu == menu.path }" @click="handleClick(menu)">
              <component :is="menu.icon" class="icon" />
              <span class="tabLabel">{{ menu.labelKey ? $t(menu.labelKey) : "" }}</span>
            </div>
            <i-right v-if="index < flowMenus.length - 1" class="flowArrow" />
          </template>
          <template v-if="auxMenus.length">
            <div class="divider"></div>
            <template v-for="menu in auxMenus" :key="menu.path">
              <div class="moduleTab f ac" :class="{ active: activeMenu == menu.path }" @click="handleClick(menu)">
                <component :is="menu.icon" class="icon" />
                <span class="tabLabel">{{ menu.labelKey ? $t(menu.labelKey) : "" }}</span>
              </div>
            </template>
          </template>
        </div>
      </div>
      <div class="viewBox">
        <router-view v-slot="{ Component }">
          <component :is="Component" :key="$route.fullPath" />
        </router-view>
      </div>
    </div>
  </div>
  <hello />
  <setting />
  <!-- 命令面板：Cmd/Ctrl + K 呼出，快速跳转项目内模块 -->
  <t-dialog v-model:visible="commandPaletteVisible" :header="$t('workbench.commandPalette')" placement="top" top="15vh" width="440px" :footer="false" destroy-on-close>
    <div class="commandList">
      <div class="commandItem f ac" v-for="item in commandItems" :key="item.path" @click="runCommand(item)">
        <component :is="item.icon" class="icon" />
        <span class="commandLabel">{{ item.labelKey ? $t(item.labelKey) : "" }}</span>
      </div>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import { useLocalStorage } from "@vueuse/core";
import axios from "@/utils/axios";
import setting from "@/components/setting/index.vue";
import hello from "@/components/hello.vue";
import { useShortcuts, dispatchSaveEvent } from "@/utils/shortcuts";
import projectStore from "@/stores/project";
const { project } = storeToRefs(projectStore());
import settingStore from "@/stores/setting";
import { NotifyPlugin } from "tdesign-vue-next";
const { showSetting, isElectron, needUpdate } = storeToRefs(settingStore());
// 侧栏展开/收起状态持久化
const menuExpanded = useLocalStorage("menuExpanded", false);
const menuList = ref([
  { type: "btn", path: "/project", labelKey: "workbench.menu.myProject", icon: "i-folder-close" },
  { type: "btn", path: "/knowledge", labelKey: "workbench.menu.knowledge", icon: "i-book", needProject: true },
  { type: "btn", path: "/assets", labelKey: "workbench.menu.assetCenter", icon: "i-receive", needProject: true },
  { type: "btn", path: "/task", labelKey: "workbench.menu.taskCenter", icon: "i-view-list" },
  { type: "btn", path: "/dashboard", labelKey: "workbench.menu.dashboard", icon: "i-data-display" },
  // { type: "divider" },
]);

const rightBtnList = ref([
  // 创作主流程：按顺序用箭头串联
  { type: "btn", path: "/novel", labelKey: "workbench.menu.novel", icon: "i-notebook", needProject: true, flow: true },
  { type: "btn", path: "/scriptAgent", labelKey: "workbench.menu.scriptAgent", icon: "i-color-filter", needProject: true, flow: true },
  { type: "btn", path: "/script", labelKey: "workbench.menu.scriptManage", icon: "i-document-folder", needProject: true, flow: true },
  { type: "btn", path: "/cornerScape", labelKey: "workbench.menu.cornerScape", icon: "i-peoples-two", needProject: true, flow: true },
  { type: "btn", path: "/production", labelKey: "workbench.menu.production", icon: "i-carousel-video", needProject: true, flow: true },
  { type: "btn", path: "/output", labelKey: "workbench.menu.outputLibrary", icon: "i-film", needProject: true, flow: true },
]);

// 流程内（箭头串联）与流程外（辅助库）分组渲染
const flowMenus = computed(() => rightBtnList.value.filter((m) => m.type === "btn" && m.flow));
const auxMenus = computed(() => rightBtnList.value.filter((m) => m.type === "btn" && !m.flow));

const router = useRouter();
const route = useRoute();
const activeMenu = ref(route.path);

watch(
  () => route.path,
  (newPath) => {
    activeMenu.value = newPath;
  },
);

function handleClick(menu: any) {
  if (menu.needProject && !project.value) {
    window.$message.info($t("workbench.selectProjectFirst"));
    return;
  }
  router.push(menu.path);
  activeMenu.value = menu.path;
}

// ===== 命令面板（Cmd/Ctrl + K）=====
const commandPaletteVisible = ref(false);
const commandItems = computed(() => [
  ...menuList.value.filter((m) => m.type === "btn"),
  ...rightBtnList.value.filter((m) => m.type === "btn"),
]);
function runCommand(item: any) {
  commandPaletteVisible.value = false;
  handleClick(item);
}
useShortcuts({
  save: () => dispatchSaveEvent(),
  commandPalette: () => {
    commandPaletteVisible.value = true;
  },
});

async function checkVersion() {
  const { data } = await axios.post("/setting/about/checkUpdate", {
    source: "Hopeflow",
  });
  if (data.needUpdate) {
    needUpdate.value = true;
    const { activeMenu: settingActiveMenu } = storeToRefs(settingStore());
    const notifyInstance = NotifyPlugin.success({
      title: $t("version.newVersion") as string,
      content: () =>
        h(
          "div",
          { style: "text-align: right; padding-top: 4px;" },
          h(
            "span",
            {
              style: "color: #ed7b2f; font-size: 12px; cursor: pointer;",
              onClick: () => {
                settingActiveMenu.value = "about";
                showSetting.value = true;
                NotifyPlugin.close(notifyInstance);
              },
            },
            $t("skillScan.openSettings"),
          ),
        ),
      closeBtn: true,
      placement: "bottom-right",
    });
  } else {
    needUpdate.value = false;
  }
}

let checkVersionTimer: ReturnType<typeof setInterval> | null = null;

function startVersionCheck() {
  checkVersion();
  checkVersionTimer = setInterval(
    () => {
      checkVersion();
    },
    2 * 60 * 1000,
  );
}

function stopVersionCheck() {
  if (checkVersionTimer) {
    clearInterval(checkVersionTimer);
    checkVersionTimer = null;
  }
}

watch(needUpdate, (val) => {
  if (val) stopVersionCheck();
});

onMounted(() => {
  // 检查更新功能暂时隐藏
  // startVersionCheck();
});

onUnmounted(() => {
  stopVersionCheck();
});
</script>

<style lang="scss" scoped>
.main {
  width: 100vw;
  height: 100%;
  display: flex;

  // ===== 深色侧边栏（企业风，不随主题翻转）=====
  .menu {
    width: var(--app-sidebar-width-collapsed);
    height: 100%;
    flex-shrink: 0;
    overflow-x: hidden;
    overflow-y: auto;
    background-color: var(--app-sidebar-bg);
    border-right: 1px solid var(--app-sidebar-border);
    padding: 12px 0;
    color: var(--app-sidebar-text);
    transition: width 0.2s ease;

    &.is-expanded {
      width: var(--app-sidebar-width-expanded);

      .logoBox {
        gap: 10px;
        justify-content: flex-start;
        padding-left: 18px;
      }
      .item {
        width: calc(100% - 16px);
        justify-content: flex-start;
        gap: 10px;
        padding: 0 12px;
      }
      .divider {
        width: calc(100% - 16px);
      }
    }

    .logoBox {
      width: 100%;
      height: 40px;
      margin-bottom: 12px;

      .logo {
        width: 32px;
        height: 32px;
        flex-shrink: 0;
        background-color: var(--app-sidebar-logo);
        mask: url("@/assets/logo-mask.svg") no-repeat center;
        mask-size: contain;
        -webkit-mask: url("@/assets/logo-mask.svg") no-repeat center;
        -webkit-mask-size: contain;
      }
    }

    .logoText {
      font-size: 16px;
      font-weight: 700;
      white-space: nowrap;
      color: var(--app-sidebar-logo);
    }

    .itemBox {
      flex: 1;
      width: 100%;
      height: 100%;
      padding: 4px 8px;
    }

    .footItem {
      width: 100%;
      height: fit-content;
      padding: 4px 8px;
    }

    .item {
      margin-top: 4px;
      margin-bottom: 4px;
      cursor: pointer;
      position: relative;
      width: 48px;
      height: 44px;
      border-radius: 10px;
      color: var(--app-sidebar-text);
      transition: background-color 0.2s ease, color 0.2s ease;

      .icon {
        font-size: 20px;
        flex-shrink: 0;
      }

      .menuLabel {
        font-size: 14px;
        white-space: nowrap;
        color: var(--app-sidebar-text);
        overflow: hidden;
        text-overflow: ellipsis;
        transition: color 0.2s ease;
      }

      &:hover {
        background-color: var(--app-sidebar-bg-hover);
        color: var(--app-sidebar-text-hover);

        .menuLabel {
          color: var(--app-sidebar-text-hover);
        }
      }
    }

    .item.active {
      background-color: var(--td-brand-color-light);
      color: var(--td-brand-color);

      .menuLabel {
        color: var(--td-brand-color);
      }

      // 飞书式左侧选中指示条
      &::before {
        content: "";
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 3px;
        height: 18px;
        border-radius: 0 2px 2px 0;
        background-color: var(--td-brand-color);
      }
    }

    .divider {
      width: calc(100% - 16px);
      height: 1px;
      background-color: var(--app-sidebar-border);
      margin: 8px 8px;
    }

    &::-webkit-scrollbar {
      width: 4px;
    }
    &::-webkit-scrollbar-thumb {
      background-color: var(--td-scrollbar-color);
      border-radius: 4px;

      &:hover {
        background-color: var(--td-scrollbar-hover-color);
      }
    }
    &::-webkit-scrollbar-track {
      background-color: transparent;
    }
  }

  // ===== 内容区 =====
  .view {
    flex: 1;
    width: 100%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background-color: var(--page);

    .topMenu {
      height: var(--app-topbar-height);
      flex-shrink: 0;
      padding: 0 var(--app-content-padding);
      border-bottom: 1px solid var(--td-border-level-1-color);
      background-color: var(--page);

      .title {
        min-width: 0;

        .titleText {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 320px;
        }
      }

      .rightBtnList {
        gap: 8px;

        // 流程节点之间的箭头：小号、弱化，与两侧标签保持呼吸感
        .flowArrow {
          display: inline-flex;
          align-items: center;
          font-size: 12px;
          color: var(--td-text-color-disabled);
          margin: 0 2px;
          flex-shrink: 0;
        }

        .moduleTab {
          height: 32px;
          padding: 0 12px;
          gap: 6px;
          border-radius: var(--td-radius-round);
          cursor: pointer;
          color: var(--td-text-color-secondary);
          transition: all 0.2s;

          .icon {
            font-size: 16px;
          }

          .tabLabel {
            font-size: 14px;
            white-space: nowrap;
          }

          &:hover {
            background-color: var(--td-bg-color-container-hover);
            color: var(--td-text-color-primary);
          }

          &.active {
            background-color: var(--td-brand-color-light);
            color: var(--td-brand-color);
          }
        }

        .divider {
          width: 1px;
          height: 24px;
          background-color: var(--td-border-level-1-color);
          margin: 0 4px;
        }
      }
    }

    .viewBox {
      flex: 1;
      width: 100%;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      scrollbar-gutter: stable;
      padding: var(--app-content-padding);
    }
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.commandList {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .commandItem {
    gap: 10px;
    padding: 10px 12px;
    border-radius: var(--td-radius-medium);
    cursor: pointer;
    color: var(--td-text-color-primary);

    .icon {
      font-size: 18px;
      color: var(--td-text-color-secondary);
    }

    .commandLabel {
      font-size: 14px;
    }

    &:hover {
      background-color: var(--td-bg-color-container-hover);
    }
  }
}
</style>
