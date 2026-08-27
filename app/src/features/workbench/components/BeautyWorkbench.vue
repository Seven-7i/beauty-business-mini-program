<script setup lang="ts">
import AppIcon from "@/features/shared/components/AppIcon.vue";

defineEmits<{
  (event: "open-module"): void;
}>();
</script>

<template>
  <view class="workbench">
    <view class="workbench__atmosphere workbench__atmosphere--rose" aria-hidden="true" />
    <view class="workbench__atmosphere workbench__atmosphere--sand" aria-hidden="true" />
    <view class="workbench__atmosphere workbench__atmosphere--slate" aria-hidden="true" />

    <view class="workbench__content">
      <view class="workbench__greeting">
        <text class="workbench__eyebrow">庄月空间</text>
        <text class="workbench__title">下午好</text>
        <text class="workbench__subtitle">选择一个业务空间，开始今天的工作</text>

        <view class="workbench__matrix" aria-hidden="true">
          <view
            v-for="index in 9"
            :key="index"
            class="workbench__matrix-tile"
          />
        </view>
      </view>

      <view class="workbench__section-heading">
        <view class="workbench__section-title">
          <view class="workbench__section-mark" />
          <text>业务空间</text>
        </view>
      </view>

      <button
        class="module-card"
        aria-label="进入美容模块"
        hover-class="module-card--pressed"
        @click="$emit('open-module')"
      >
        <view class="module-card__number">01</view>
        <view class="module-card__copy">
          <text class="module-card__title">美容</text>
          <text class="module-card__meta">顾客 · 项目 · 预约</text>
        </view>
        <AppIcon
          class="module-card__arrow"
          name="chevron-right"
          :size="25"
          color="#545852"
        />
      </button>
    </view>
  </view>
</template>

<style scoped>
.workbench {
  position: relative;
  min-height: 100vh;
  box-sizing: border-box;
  overflow: hidden;
  background: #f3f1ec;
  color: #242620;
}

.workbench__atmosphere {
  position: absolute;
  border-radius: 50%;
  filter: blur(92rpx);
  pointer-events: none;
}

.workbench__atmosphere--rose {
  top: 210rpx;
  left: -160rpx;
  width: 430rpx;
  height: 430rpx;
  background: rgba(183, 131, 140, 0.26);
}

.workbench__atmosphere--sand {
  right: -190rpx;
  bottom: 220rpx;
  width: 510rpx;
  height: 510rpx;
  background: rgba(188, 158, 121, 0.28);
}

.workbench__atmosphere--slate {
  top: 610rpx;
  left: 150rpx;
  width: 360rpx;
  height: 360rpx;
  background: rgba(61, 74, 93, 0.1);
}

.workbench__content {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  padding: 64rpx 46rpx calc(190rpx + env(safe-area-inset-bottom));
}

.workbench__greeting {
  position: relative;
  display: flex;
  min-height: 300rpx;
  flex-direction: column;
}

.workbench__eyebrow {
  color: #696c67;
  font-size: 25rpx;
  font-weight: 500;
  letter-spacing: 3rpx;
}

.workbench__title {
  margin-top: 26rpx;
  color: #242620;
  font-size: 68rpx;
  font-weight: 650;
  letter-spacing: -2rpx;
  line-height: 1.12;
}

.workbench__subtitle {
  max-width: 520rpx;
  margin-top: 26rpx;
  color: #6f716c;
  font-size: 25rpx;
  line-height: 1.55;
}

.workbench__matrix {
  position: absolute;
  top: 0;
  right: -8rpx;
  display: grid;
  width: 174rpx;
  height: 174rpx;
  grid-template-columns: repeat(3, 1fr);
  gap: 15rpx;
  opacity: 0.7;
}

.workbench__matrix::after {
  position: absolute;
  right: -36rpx;
  bottom: -34rpx;
  width: 74rpx;
  height: 64rpx;
  border-right: 2rpx dashed rgba(61, 74, 93, 0.36);
  border-bottom: 2rpx dashed rgba(61, 74, 93, 0.36);
  content: "";
}

.workbench__matrix-tile {
  border: 2rpx solid rgba(106, 105, 98, 0.2);
  border-radius: 10rpx;
  background: rgba(251, 250, 247, 0.2);
}

.workbench__matrix-tile:nth-child(5) {
  border-color: rgba(188, 158, 121, 0.38);
  background: rgba(188, 158, 121, 0.46);
  box-shadow: 0 8rpx 20rpx rgba(128, 103, 75, 0.12);
}

.workbench__section-heading {
  display: flex;
  min-height: 82rpx;
  align-items: center;
  margin-top: 20rpx;
}

.workbench__section-title {
  display: flex;
  align-items: center;
  gap: 16rpx;
  color: #242620;
  font-size: 31rpx;
  font-weight: 650;
}

.workbench__section-mark {
  width: 7rpx;
  height: 28rpx;
  border-radius: 4rpx;
  background: #bca47f;
}

.module-card {
  position: relative;
  display: flex;
  width: 100%;
  min-height: 246rpx;
  box-sizing: border-box;
  align-items: center;
  margin-top: 10rpx;
  padding: 38rpx 36rpx;
  overflow: hidden;
  border: 2rpx solid rgba(255, 255, 255, 0.82);
  border-radius: 38rpx;
  background: rgba(251, 250, 247, 0.62);
  box-shadow:
    0 34rpx 72rpx rgba(75, 63, 51, 0.16),
    0 6rpx 16rpx rgba(75, 63, 51, 0.08),
    inset 0 2rpx 0 rgba(255, 255, 255, 0.92);
  color: #242620;
  text-align: left;
  transition: opacity 160ms ease, transform 160ms ease;
  -webkit-backdrop-filter: blur(32rpx) saturate(1.16);
  backdrop-filter: blur(32rpx) saturate(1.16);
}

.module-card::after {
  position: absolute;
  top: -2rpx;
  right: -2rpx;
  width: 54rpx;
  height: 54rpx;
  border-top: 10rpx solid rgba(183, 131, 140, 0.94);
  border-right: 10rpx solid rgba(183, 131, 140, 0.94);
  border-top-right-radius: 38rpx;
  content: "";
}

.module-card--pressed {
  opacity: 0.78;
  transform: scale(0.985);
}

.module-card__number {
  display: flex;
  width: 116rpx;
  height: 116rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border: 2rpx solid rgba(255, 255, 255, 0.62);
  border-radius: 28rpx;
  background: rgba(183, 131, 140, 0.92);
  box-shadow:
    0 18rpx 32rpx rgba(130, 80, 91, 0.18),
    inset 0 2rpx 0 rgba(255, 255, 255, 0.38);
  color: #fffaf8;
  font-size: 50rpx;
  font-weight: 400;
  letter-spacing: -1rpx;
}

.module-card__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  margin-left: 34rpx;
}

.module-card__title {
  color: #242620;
  font-size: 38rpx;
  font-weight: 650;
  line-height: 1.2;
}

.module-card__meta {
  margin-top: 14rpx;
  color: #72736e;
  font-size: 24rpx;
  line-height: 1.4;
}

.module-card__arrow {
  margin-left: 20rpx;
}

@media (max-width: 360px) {
  .workbench__content {
    padding-right: 36rpx;
    padding-left: 36rpx;
  }

  .workbench__greeting {
    min-height: 286rpx;
  }

  .workbench__title {
    font-size: 62rpx;
  }

  .workbench__subtitle {
    max-width: 430rpx;
  }

  .workbench__matrix {
    right: -24rpx;
    width: 150rpx;
    height: 150rpx;
    gap: 12rpx;
    opacity: 0.48;
  }

  .module-card {
    min-height: 224rpx;
    padding: 32rpx 28rpx;
  }

  .module-card__number {
    width: 104rpx;
    height: 104rpx;
    font-size: 44rpx;
  }

  .module-card__copy {
    margin-left: 26rpx;
  }
}
</style>
