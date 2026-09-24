<template>
  <div class="uiConfig">
    <t-form labelAlign="top">
      <t-form-item label="颜色模式">
        <t-radio-group variant="default-filled" v-model="themeSetting.mode">
          <t-radio-button value="auto">自动</t-radio-button>
          <t-radio-button value="light">浅色</t-radio-button>
          <t-radio-button value="dark">深色</t-radio-button>
        </t-radio-group>
      </t-form-item>
      <t-form-item label="主题色">
        <div class="themeColorConfig">
          <button
            v-for="color in presetColors"
            :key="color"
            class="presetColor"
            :class="{ active: normalizeColor(themeSetting.primaryColor) === color }"
            :style="{ backgroundColor: color }"
            type="button"
            @click="themeSetting.primaryColor = color" />
          <t-color-picker v-model="themeSetting.primaryColor" :color-modes="['monochrome']" format="HEX" :enable-alpha="false" />
        </div>
      </t-form-item>
      <t-form-item label="字体大小">
        <t-radio-group variant="default-filled" v-model="themeSetting.fontSize">
          <t-radio-button :value="12">极小</t-radio-button>
          <t-radio-button :value="13">较小</t-radio-button>
          <t-radio-button :value="14">小</t-radio-button>
          <t-radio-button :value="16">默认</t-radio-button>
          <t-radio-button :value="18">大</t-radio-button>
          <t-radio-button :value="20">较大</t-radio-button>
          <t-radio-button :value="22">极大</t-radio-button>
        </t-radio-group>
      </t-form-item>
      <t-form-item label="字体">
        <t-select v-model="themeSetting.fontFamily">
          <t-option v-for="font in fontOptions" :key="font.key" :value="font.key" :label="font.label" />
        </t-select>
      </t-form-item>
    </t-form>
  </div>
</template>

<script setup lang="ts">
import settingStore from "@/stores/setting";
import { applyThemeMode, applyThemeColor, toggleThemeWithTransition, applyFontFamily, fontOptions } from "@/utils/theme";
const { themeSetting } = storeToRefs(settingStore());

const presetColors = ["#0052D9", "#2BA471", "#ED7B2F", "#E34D59", "#7B61FF", "#000000"];

const normalizeColor = (value: string) => {
  const hex = (value || "").trim();
  if (!hex) return "#0052D9";

  const normalized = hex.startsWith("#") ? hex : `#${hex}`;
  const match = /^#[0-9a-fA-F]{6}$/.test(normalized);

  return match ? normalized.toUpperCase() : "#0052D9";
};

watch(
  () => themeSetting.value.mode,
  (mode) => {
    toggleThemeWithTransition(undefined, () => {
      applyThemeMode(mode);
      applyThemeColor(normalizeColor(themeSetting.value.primaryColor));
    });
  },
);

const applyFontSize = (size: number) => {
  document.documentElement.style.fontSize = `${size}px`;
};

applyFontSize(themeSetting.value.fontSize);

watch(
  () => themeSetting.value.fontSize,
  (size) => applyFontSize(size),
);

watch(
  () => themeSetting.value.fontFamily,
  (key) => applyFontFamily(key),
);

watch(
  () => themeSetting.value.primaryColor,
  (color) => {
    const normalized = normalizeColor(color);

    if (normalized !== color) {
      themeSetting.value.primaryColor = normalized;
      return;
    }

    applyThemeColor(normalized);
  },
);
</script>

<style lang="scss" scoped>
.themeColorConfig {
  display: flex;
  align-items: center;
  gap: 10px;
}

.presetColor {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 50%;
  cursor: pointer;
  outline: none;
  position: relative;
  transition: all 0.2s ease;

  &::after {
    content: "";
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 2px solid transparent;
    transition: border-color 0.2s ease;
  }

  &:hover::after {
    border-color: var(--td-component-border, #dcdcdc);
  }

  &.active::after {
    border-color: var(--td-brand-color);
  }
}
</style>
