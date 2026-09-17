<script setup lang="ts">
import type { AppIconName } from "@/features/shared/components/AppIcon.vue";
import AppIcon from "@/features/shared/components/AppIcon.vue";
import type { BeautyModuleTab } from "../types";

defineProps<{ activeTab: BeautyModuleTab }>();

const emit = defineEmits<{
  (event: "select", tab: BeautyModuleTab): void;
}>();

const tabs: readonly {
  id: BeautyModuleTab;
  label: string;
  icon: AppIconName;
}[] = [
  { id: "home", label: "首页", icon: "home" },
  { id: "schedule", label: "日程", icon: "calendar" },
  { id: "reports", label: "报表", icon: "reports" },
  { id: "data", label: "数据", icon: "data" },
];
</script>

<template>
  <nav class="module-navigation" aria-label="美容模块导航">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      :data-tab="tab.id"
      class="module-navigation__item"
      :class="{ 'module-navigation__item--active': activeTab === tab.id }"
      :aria-current="activeTab === tab.id ? 'page' : undefined"
      @click="emit('select', tab.id)"
    >
      <AppIcon :name="tab.icon" :size="25" />
      <text class="module-navigation__label">{{ tab.label }}</text>
    </button>
  </nav>
</template>

<style scoped>
.module-navigation {
  position: fixed;
  z-index: 20;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding: 12rpx 24rpx calc(12rpx + env(safe-area-inset-bottom));
  border-top: 2rpx solid rgba(139, 112, 128, 0.12);
  background: #fffdfd;
  box-shadow: 0 -12rpx 36rpx rgba(106, 76, 94, 0.08);
}

.module-navigation__item {
  display: flex;
  min-width: 0;
  min-height: 88rpx;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  border-radius: 24rpx;
  background: transparent;
  color: #928c91;
  flex-direction: column;
  line-height: 1;
}

.module-navigation__item--active {
  border: 2rpx solid rgba(255, 255, 255, 0.8);
  background: linear-gradient(135deg, rgba(242, 232, 243, 0.88) 0%, rgba(238, 232, 248, 0.84) 100%);
  box-shadow: inset 0 2rpx 0 rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(18rpx);
  color: #7954a0;
}

.module-navigation__label {
  color: inherit;
  font-size: 20rpx;
  font-weight: 500;
  line-height: 1.2;
}

.module-navigation__item--active .module-navigation__label {
  font-weight: 650;
}
</style>
