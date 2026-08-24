<script setup lang="ts">
import type { BeautyModuleTab } from "../types";

defineProps<{ activeTab: BeautyModuleTab }>();

const emit = defineEmits<{
  (event: "select", tab: BeautyModuleTab): void;
}>();

const tabs: readonly { id: BeautyModuleTab; label: string; glyph: string }[] = [
  { id: "home", label: "首页", glyph: "⌂" },
  { id: "schedule", label: "日程", glyph: "□" },
  { id: "reports", label: "报表", glyph: "▥" },
  { id: "data", label: "数据", glyph: "◇" },
];
</script>

<template>
  <view class="module-navigation">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      :data-tab="tab.id"
      class="module-navigation__item"
      :class="{ 'module-navigation__item--active': activeTab === tab.id }"
      @click="emit('select', tab.id)"
    >
      <text class="module-navigation__glyph">{{ tab.glyph }}</text>
      <text>{{ tab.label }}</text>
    </button>
  </view>
</template>

<style scoped>
.module-navigation {
  position: fixed;
  z-index: 20;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  padding: 10rpx 14rpx calc(10rpx + env(safe-area-inset-bottom));
  border-top: 2rpx solid #e3e6ec;
  background: rgba(255, 255, 255, 0.97);
}

.module-navigation__item {
  display: flex;
  min-height: 76rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3rpx;
  background: transparent;
  color: #808794;
  font-size: 20rpx;
  line-height: 1.2;
}

.module-navigation__item--active {
  color: #294d96;
  font-weight: 600;
}

.module-navigation__glyph {
  font-size: 34rpx;
  line-height: 1;
}
</style>
