<template>
  <div class="pageToolbar">
    <div class="toolbarInfo">
      <h3 class="pageTitle">{{ title }}</h3>
      <span v-if="subtitle" class="pageSubtitle">{{ subtitle }}</span>
    </div>
    <div class="toolbarActions" v-if="$slots.default">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
  }>(),
  { subtitle: "" },
);
</script>

<style scoped lang="scss">
// 统一各业务页顶部工具条：左侧标题+副标题，右侧操作区
.pageToolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  flex-shrink: 0;

  .toolbarInfo {
    display: flex;
    align-items: baseline;
    gap: var(--app-space-2);
    min-width: 0;

    .pageTitle {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--td-text-color-primary);
      white-space: nowrap;
    }

    .pageSubtitle {
      font-size: 13px;
      color: var(--td-text-color-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .toolbarActions {
    display: flex;
    align-items: center;
    gap: var(--app-space-2);
    flex-shrink: 0;
  }
}
</style>
