<script setup lang="ts">
import { computed } from "vue";
import {
  APP_ICON_GLYPHS,
  type AppIconName as GeneratedAppIconName,
} from "@/features/shared/icon-font.generated";

export type AppIconName = GeneratedAppIconName;

const props = withDefaults(
  defineProps<{
    name: AppIconName;
    size?: number;
    color?: string;
  }>(),
  {
    size: 24,
    color: "currentColor",
  },
);

const iconStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  color: props.color,
  fontSize: `${props.size}px`,
}));

const glyph = computed(() => APP_ICON_GLYPHS[props.name]);
</script>

<template>
  <view class="app-icon" :style="iconStyle" aria-hidden="true">
    <text class="app-icon__glyph">{{ glyph }}</text>
  </view>
</template>

<style scoped>
@font-face {
  font-family: "ZhuangYueIcons";
  src: url("~@/static/fonts/zhuangyue-icons.ttf") format("truetype");
  font-style: normal;
  font-weight: normal;
}

.app-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  color: inherit;
  line-height: 0;
}

.app-icon__glyph {
  display: block;
  width: 100%;
  height: 100%;
  font-family: "ZhuangYueIcons";
  font-style: normal;
  font-weight: normal;
  line-height: 1;
  text-align: center;
}
</style>
