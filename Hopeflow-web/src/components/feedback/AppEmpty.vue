<template>
  <div class="appEmpty" :class="{ 'is-compact': compact }">
    <t-empty :title="title" :description="description">
      <template #action>
        <slot name="action" />
      </template>
    </t-empty>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    description?: string;
    compact?: boolean;
  }>(),
  { compact: false },
);
</script>

<style scoped lang="scss">
.appEmpty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 0;

  &.is-compact {
    padding: 24px 0;
  }

  // 统一空状态文字层级
  :deep(.t-empty__title) {
    font-size: 16px;
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  :deep(.t-empty__description) {
    color: var(--td-text-color-secondary);
  }
}
</style>
