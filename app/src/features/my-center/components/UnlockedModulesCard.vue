<script setup lang="ts">
import { computed } from "vue";
import type { BusinessModuleId } from "@/domain/business-module";

const props = defineProps<{
  unlockedModules: readonly BusinessModuleId[];
  loading: boolean;
}>();

const beautyUnlocked = computed(() => props.unlockedModules.includes("beauty"));
</script>

<template>
  <view class="unlocked-card" :aria-busy="props.loading">
    <template v-if="props.loading">
      <view class="unlocked-card__badge unlocked-card__badge--loading" aria-hidden="true" />
      <view class="unlocked-card__loading-copy">
        <view class="unlocked-card__loading-line unlocked-card__loading-line--title" />
        <view class="unlocked-card__loading-line unlocked-card__loading-line--meta" />
      </view>
      <text class="unlocked-card__loading-label">正在读取</text>
    </template>

    <template v-else-if="beautyUnlocked">
      <view class="unlocked-card__badge" aria-hidden="true">
        <text>01</text>
      </view>
      <view class="unlocked-card__copy">
        <text class="unlocked-card__name">美容</text>
        <text class="unlocked-card__meta">顾客 · 项目 · 预约</text>
      </view>
      <text class="unlocked-card__status" role="status">已解锁</text>
    </template>

    <view v-else class="unlocked-card__empty" role="status">
      <text class="unlocked-card__empty-title">暂无已解锁模块</text>
      <text class="unlocked-card__empty-copy">可在下方输入模块授权码</text>
    </view>
  </view>
</template>

<style scoped>
.unlocked-card {
  display: flex;
  min-height: 218rpx;
  box-sizing: border-box;
  align-items: center;
  gap: 30rpx;
  margin-top: 10rpx;
  padding: 34rpx 36rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.82);
  border-radius: 34rpx;
  background: rgba(251, 250, 247, 0.6);
  box-shadow:
    0 26rpx 58rpx rgba(75, 63, 51, 0.12),
    inset 0 2rpx 0 rgba(255, 255, 255, 0.9);
  -webkit-backdrop-filter: blur(32rpx) saturate(1.14);
  backdrop-filter: blur(32rpx) saturate(1.14);
}

.unlocked-card__badge {
  display: flex;
  width: 126rpx;
  height: 126rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border: 2rpx solid rgba(255, 255, 255, 0.72);
  border-radius: 28rpx;
  background: linear-gradient(145deg, #b96f79, #c88b92);
  box-shadow: 0 16rpx 34rpx rgba(154, 86, 93, 0.2);
  color: #fffaf7;
  font-size: 49rpx;
  font-weight: 500;
  letter-spacing: 1rpx;
  line-height: 1;
}

.unlocked-card__badge--loading {
  background: rgba(183, 131, 140, 0.18);
  box-shadow: none;
}

.unlocked-card__copy,
.unlocked-card__loading-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.unlocked-card__name,
.unlocked-card__meta {
  display: block;
  overflow-wrap: anywhere;
}

.unlocked-card__name {
  color: #242620;
  font-size: 36rpx;
  font-weight: 650;
  line-height: 1.2;
}

.unlocked-card__meta {
  margin-top: 16rpx;
  color: #6f716c;
  font-size: 23rpx;
  line-height: 1.45;
}

.unlocked-card__status {
  flex: none;
  padding: 13rpx 20rpx;
  border: 2rpx solid rgba(61, 74, 93, 0.16);
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.28);
  color: #747772;
  font-size: 21rpx;
  line-height: 1.2;
}

.unlocked-card__loading-line {
  height: 22rpx;
  border-radius: 999rpx;
  background: rgba(61, 74, 93, 0.1);
}

.unlocked-card__loading-line--title {
  width: 104rpx;
}

.unlocked-card__loading-line--meta {
  width: 190rpx;
  margin-top: 22rpx;
}

.unlocked-card__loading-label {
  flex: none;
  color: #898b86;
  font-size: 21rpx;
}

.unlocked-card__empty {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.unlocked-card__empty-title {
  color: #3f413c;
  font-size: 27rpx;
  font-weight: 620;
}

.unlocked-card__empty-copy {
  margin-top: 10rpx;
  color: #7d7e78;
  font-size: 21rpx;
}

@media (max-width: 360px) {
  .unlocked-card {
    gap: 22rpx;
    padding-right: 26rpx;
    padding-left: 26rpx;
  }

  .unlocked-card__badge {
    width: 108rpx;
    height: 108rpx;
    font-size: 43rpx;
  }

  .unlocked-card__name {
    font-size: 32rpx;
  }

  .unlocked-card__status {
    padding-right: 16rpx;
    padding-left: 16rpx;
  }
}
</style>
