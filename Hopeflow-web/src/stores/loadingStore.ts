import { ref } from "vue";
import { defineStore } from "pinia";

function createDefaultMap<T extends string | number | symbol>(defaultValue: boolean): Record<T, boolean> {
  const inner: Record<T, boolean> = {} as Record<T, boolean>;
  return new Proxy(inner, {
    get(target, prop: string | number | symbol) {
      if (prop in target) {
        return target[prop as keyof typeof target];
      }
      return defaultValue;
    },
    set(target, prop: string | number | symbol, value: boolean) {
      (target as any)[prop] = value;
      return true;
    },
  }) as Record<T, boolean>;
}

export default defineStore(
  "loadingStore",
  () => {
    const videoGenerateloading = ref<Record<number, boolean>>(createDefaultMap<number>(false));
    const assetGenerateloading = ref<Record<number, boolean>>(createDefaultMap<number>(false));
    const assetGeneratePromptloading = ref<Record<number, boolean>>(createDefaultMap<number>(false));
    const scriptGenerateLoading = ref<Record<number, boolean>>(createDefaultMap<number>(false));
    const storeboardGenerateLoading = ref<Record<number, boolean>>(createDefaultMap<number>(false));

    const batchGenerateImageLoading = ref<Record<string, boolean>>(createDefaultMap<string>(false));
    const batchGenerateStoryboardImageLoading = ref<Record<number, boolean>>(createDefaultMap<number>(false));

    const batchGeneratePromptLoading = ref<Record<string, boolean>>(createDefaultMap<string>(false));
    const batchGenerateStoryboardPromptLoading = ref<Record<number, boolean>>(createDefaultMap<number>(false));
    return {
      videoGenerateloading,
      assetGenerateloading,
      assetGeneratePromptloading,
      scriptGenerateLoading,
      storeboardGenerateLoading,
      batchGenerateImageLoading,
      batchGenerateStoryboardImageLoading,
      batchGeneratePromptLoading,
      batchGenerateStoryboardPromptLoading,
    };
  },
  { persist: false },
);
