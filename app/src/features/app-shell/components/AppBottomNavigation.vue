<script setup lang="ts">
import type { AppShellTab } from "../types";

defineProps<{ activeTab: AppShellTab }>();

const emit = defineEmits<{
  (event: "select", tab: AppShellTab): void;
}>();

const tabs: readonly { id: AppShellTab; label: string; glyph: string }[] = [
  { id: "workbench", label: "工作台", glyph: "⌂" },
  { id: "mine", label: "我的", glyph: "○" },
];
</script>

<template>
  <view class="app-navigation">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      :data-tab="tab.id"
      class="app-navigation__item"
      :class="{ 'app-navigation__item--active': activeTab === tab.id }"
      @click="emit('select', tab.id)"
    >
      <text class="app-navigation__glyph">{{ tab.glyph }}</text>
      <text>{{ tab.label }}</text>
    </button>
  </view>
</template>

<style scoped>
.app-navigation {
  position: fixed;
  z-index: 20;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  padding: 10rpx 14rpx calc(10rpx + env(safe-area-inset-bottom));
  border-top: 2rpx solid #e3e6ec;
  background: rgba(255, 255, 255, 0.96);
}

.app-navigation__item {
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

.app-navigation__item--active {
  color: #294d96;
  font-weight: 600;
}

.app-navigation__glyph {
  font-size: 34rpx;
  line-height: 1;
}
</style>
