<template>
  <slot v-if="!loading" />
  <div v-else class="appLoading">
    <t-loading size="large" :text="text" />
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    loading: boolean;
    text?: string;
  }>(),
  { text: "" },
);
</script>

<style scoped lang="scss">
.appLoading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
}
</style>
