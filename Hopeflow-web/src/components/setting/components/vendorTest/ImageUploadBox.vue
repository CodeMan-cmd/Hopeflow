<template>
  <div class="imageUploadBox" :class="{ optional, hasFile: !!modelValue }" @click="trigger" @dragover.prevent @drop.prevent="handleDrop">
    <img v-if="modelValue" :src="previewUrl" class="preview" alt="preview" />
    <template v-else>
      <i-picture theme="outline" size="26" fill="var(--td-brand-color)" />
      <p class="boxText">{{ label || $t("settings.vendor.test.uploadImage") }}</p>
      <p v-if="optional" class="optionalTag">{{ $t("settings.vendor.test.optional") }}</p>
    </template>
    <button v-if="modelValue" class="clearBtn" @click.stop="clear">
      <i-close theme="outline" size="12" />
    </button>
    <input ref="inputRef" type="file" accept="image/*" style="display: none" @change="handleChange" />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: File | null;
  optional?: boolean;
  label?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [val: File | null];
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const previewUrl = ref("");

watch(
  () => props.modelValue,
  (file) => {
    if (file) previewUrl.value = URL.createObjectURL(file);
    else previewUrl.value = "";
  },
);

function trigger() {
  inputRef.value?.click();
}

function handleChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0] ?? null;
  emit("update:modelValue", file);
  (e.target as HTMLInputElement).value = "";
}

function handleDrop(e: DragEvent) {
  const file = e.dataTransfer?.files?.[0] ?? null;
  if (file?.type.startsWith("image/")) emit("update:modelValue", file);
}

function clear() {
  emit("update:modelValue", null);
}
</script>

<style lang="scss" scoped>
.imageUploadBox {
  position: relative;
  width: 120px;
  height: 100px;
  border: 2px dashed var(--td-component-border);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: border-color 0.2s;
  overflow: hidden;
  flex-shrink: 0;

  &:hover {
    border-color: var(--td-brand-color);
  }

  &.optional {
    border-style: dashed;
    opacity: 0.85;
  }

  &.hasFile {
    border-color: var(--td-success-color);
  }

  .preview {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .boxText {
    font-size: 12px;
    margin: 0;
    text-align: center;
    padding: 0 4px;
    color: var(--td-text-color-secondary);
  }

  .optionalTag {
    font-size: 12px;
    color: var(--td-text-color-placeholder);
    margin: 0;
  }

  .clearBtn {
    position: absolute;
    top: 3px;
    right: 3px;
    background: rgba(0, 0, 0, 0.45);
    border: none;
    border-radius: 50%;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #fff;
    padding: 0;

    &:hover {
      background: rgba(0, 0, 0, 0.7);
    }
  }
}
</style>
