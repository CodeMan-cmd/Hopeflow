<template>
  <div
    class="audioUploadBox"
    :class="{ hasFile: !!modelValue }"
    @click="trigger"
    @dragover.prevent
    @drop.prevent="handleDrop"
  >
    <template v-if="modelValue">
      <i-music-one theme="filled" size="26" fill="var(--td-success-color)" />
      <p class="boxText fileName">{{ modelValue.name }}</p>
    </template>
    <template v-else>
      <i-music-one theme="outline" size="26" fill="var(--td-brand-color)" />
      <p class="boxText">{{ label || $t('settings.vendor.test.uploadAudio') }}</p>
    </template>
    <button v-if="modelValue" class="clearBtn" @click.stop="clear">
      <i-close theme="outline" size="12" />
    </button>
    <input ref="inputRef" type="file" accept="audio/*" style="display:none" @change="handleChange" />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: File | null;
  label?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [val: File | null];
}>();


const inputRef = ref<HTMLInputElement | null>(null);

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
  if (file?.type.startsWith("audio/")) emit("update:modelValue", file);
}

function clear() {
  emit("update:modelValue", null);
}
</script>

<style lang="scss" scoped>
.audioUploadBox {
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
  padding: 4px;

  &:hover {
    border-color: var(--td-brand-color);
  }

  &.hasFile {
    border-color: var(--td-success-color);
  }

  .boxText {
    font-size: 12px;
    margin: 0;
    text-align: center;
    padding: 0 4px;
    color: var(--td-text-color-secondary);

    &.fileName {
      font-size: 12px;
      word-break: break-all;
      max-height: 36px;
      overflow: hidden;
    }
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
