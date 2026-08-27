<script setup lang="ts">
import AppIcon from "@/features/shared/components/AppIcon.vue";
import type { AppShellTab } from "@/features/app-shell/types";

const props = defineProps<{
  activeTab: AppShellTab;
}>();

const emit = defineEmits<{
  (event: "select", tab: AppShellTab): void;
}>();
</script>

<template>
  <view class="app-navigation">
    <button
      class="app-navigation__item"
      :class="{ 'app-navigation__item--active': props.activeTab === 'workbench' }"
      data-tab="workbench"
      :aria-label="props.activeTab === 'workbench' ? '当前页面：工作台' : '前往工作台'"
      hover-class="app-navigation__item--pressed"
      @click="emit('select', 'workbench')"
    >
      <AppIcon
        name="home"
        :size="27"
        :color="props.activeTab === 'workbench' ? '#3D4A5D' : '#757770'"
      />
      <text class="app-navigation__label">工作台</text>
    </button>

    <button
      class="app-navigation__item"
      :class="{ 'app-navigation__item--active': props.activeTab === 'mine' }"
      data-tab="mine"
      :aria-label="props.activeTab === 'mine' ? '当前页面：我的' : '前往我的'"
      hover-class="app-navigation__item--pressed"
      @click="emit('select', 'mine')"
    >
      <AppIcon
        name="account"
        :size="27"
        :color="props.activeTab === 'mine' ? '#3D4A5D' : '#757770'"
      />
      <text class="app-navigation__label">我的</text>
    </button>
  </view>
</template>

<style scoped>
.app-navigation {
  position: fixed;
  z-index: 30;
  right: 28rpx;
  bottom: calc(14rpx + env(safe-area-inset-bottom));
  left: 28rpx;
  display: grid;
  min-height: 112rpx;
  box-sizing: border-box;
  grid-template-columns: repeat(2, 1fr);
  gap: 10rpx;
  padding: 10rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.78);
  border-radius: 56rpx;
  background: rgba(251, 250, 247, 0.7);
  box-shadow:
    0 20rpx 48rpx rgba(64, 57, 48, 0.14),
    inset 0 2rpx 0 rgba(255, 255, 255, 0.8);
  -webkit-backdrop-filter: blur(28rpx) saturate(1.18);
  backdrop-filter: blur(28rpx) saturate(1.18);
}

.app-navigation__item {
  display: flex;
  min-height: 88rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5rpx;
  border-radius: 44rpx;
  background: transparent;
  color: #757770;
  font-size: 20rpx;
  line-height: 1.2;
  transition: opacity 160ms ease, transform 160ms ease;
}

.app-navigation__item--active {
  background: rgba(61, 74, 93, 0.08);
  color: #3d4a5d;
  box-shadow: inset 0 2rpx 0 rgba(255, 255, 255, 0.48);
  font-weight: 600;
}

.app-navigation__item--pressed {
  opacity: 0.72;
  transform: scale(0.97);
}

.app-navigation__label {
  color: inherit;
}

@media (max-width: 360px) {
  .app-navigation {
    right: 22rpx;
    left: 22rpx;
  }
}
</style>
