<template>
  <div class="task">
    <PageToolbar :title="$t('workbench.task.title')" :subtitle="$t('workbench.task.subtitle')" />
    <taskTable :active="true" />
  </div>
</template>

<script setup lang="ts">
import pageToolbar from "@/components/pageToolbar.vue";
import taskTable from "./components/taskTable.vue";
</script>

<style lang="scss" scoped>
.task {
  display: flex;
  flex-direction: column;
  gap: var(--app-space-3);
}
</style>
