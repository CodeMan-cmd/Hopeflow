<template>
  <div class="appSkeleton" :class="`is-${variant}`">
    <!-- 卡片网格骨架 -->
    <div v-if="variant === 'card'" class="cardGrid" :style="{ gridTemplateColumns: `repeat(${columns}, 1fr)` }">
      <div v-for="i in count" :key="i" class="skeletonCard">
        <div class="sk block shimmer" />
        <div class="sk line w-60 shimmer" />
        <div class="sk line w-90 shimmer" />
        <div class="sk line w-40 shimmer" />
      </div>
    </div>
    <!-- 表格骨架 -->
    <div v-else class="tableRows">
      <div v-for="i in rows" :key="i" class="sk line w-full shimmer" />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: "card" | "table";
    count?: number;
    columns?: number;
    rows?: number;
  }>(),
  { variant: "card", count: 6, columns: 3, rows: 6 },
);
</script>

<style scoped lang="scss">
.appSkeleton {
  .cardGrid {
    display: grid;
    gap: var(--app-space-card-gap);

    .skeletonCard {
      border: 1px solid var(--td-component-stroke);
      border-radius: var(--app-radius-card);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
  }

  .tableRows {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 8px 0;
  }

  .sk {
    background: var(--td-bg-color-component);
    border-radius: var(--td-radius-default);

    &.block {
      aspect-ratio: 2 / 1;
      border-radius: var(--td-radius-medium);
    }

    &.line {
      height: 14px;
    }

    &.w-30 {
      width: 30%;
    }

    &.w-40 {
      width: 40%;
    }

    &.w-60 {
      width: 60%;
    }

    &.w-70 {
      width: 70%;
    }

    &.w-90 {
      width: 90%;
    }

    &.w-full {
      width: 100%;
    }
  }

  .shimmer {
    position: relative;
    overflow: hidden;

    &::after {
      content: "";
      position: absolute;
      inset: 0;
      transform: translateX(-100%);
      background: linear-gradient(90deg, transparent, var(--td-bg-color-secondarycontainer-hover), transparent);
      animation: appSkeletonShimmer 1.6s infinite;
    }
  }
}

@keyframes appSkeletonShimmer {
  100% {
    transform: translateX(100%);
  }
}
</style>
