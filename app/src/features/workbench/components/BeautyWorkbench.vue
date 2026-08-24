<script setup lang="ts">
defineEmits<{
  (event: "open-module"): void;
  (event: "manage-modules"): void;
  (event: "backup-restore"): void;
}>();

</script>

<template>
  <view class="workbench">
    <view class="workbench__greeting">
      <text class="workbench__eyebrow">庄月空间</text>
      <text class="workbench__title">下午好</text>
      <text class="workbench__subtitle">从这里进入已解锁模块，或管理整个系统的数据。</text>
    </view>

    <text class="workbench__section-title">已解锁模块</text>
    <view class="module-card">
      <view class="module-card__summary">
        <view class="module-card__icon">
          <view v-for="index in 4" :key="index" class="module-card__dot" />
        </view>
        <view class="module-card__copy">
          <text class="module-card__title">美容</text>
          <text class="module-card__meta">顾客 · 项目 · 预约</text>
        </view>
        <text class="module-card__arrow">›</text>
      </view>
      <button class="module-card__enter" @click="$emit('open-module')">
        进入模块
        <text class="module-card__enter-arrow">→</text>
      </button>
    </view>

    <button
      class="workbench__data-protection"
      @click="$emit('backup-restore')"
    >
      <view class="workbench__data-copy">
        <text class="workbench__data-title">数据备份与恢复</text>
        <text class="workbench__data-meta">最近导出、换机恢复与数据保护</text>
      </view>
      <text class="workbench__manage-arrow">›</text>
    </button>

    <button
      class="workbench__manage"
      @click="$emit('manage-modules')"
    >
      <text>⚙</text>
      <text>模块管理</text>
      <text class="workbench__manage-arrow">›</text>
    </button>

  </view>
</template>

<style scoped>
.workbench {
  min-height: calc(100vh - 88rpx);
  box-sizing: border-box;
  padding: 48rpx 30rpx calc(150rpx + env(safe-area-inset-bottom));
}

.workbench__greeting {
  display: flex;
  flex-direction: column;
  padding: 0 14rpx;
}

.workbench__eyebrow {
  color: #31549e;
  font-size: 23rpx;
  font-weight: 600;
  letter-spacing: 1rpx;
}

.workbench__title {
  margin-top: 20rpx;
  color: #172033;
  font-size: 46rpx;
  font-weight: 700;
}

.workbench__subtitle {
  margin-top: 12rpx;
  color: #70798a;
  font-size: 26rpx;
}

.workbench__section-title {
  display: block;
  margin: 42rpx 8rpx 16rpx;
  color: #596579;
  font-size: 23rpx;
  font-weight: 700;
}

.module-card {
  margin-top: 0;
  padding: 26rpx;
  border: 2rpx solid #dde2eb;
  border-radius: 24rpx;
  background: #ffffff;
  box-shadow: 0 12rpx 34rpx rgba(27, 42, 71, 0.07);
}

.module-card__summary {
  display: flex;
  align-items: center;
  padding: 4rpx 2rpx 26rpx;
}

.module-card__icon {
  display: grid;
  width: 82rpx;
  height: 82rpx;
  box-sizing: border-box;
  grid-template-columns: 1fr 1fr;
  gap: 8rpx;
  padding: 18rpx;
  border-radius: 20rpx;
  background: linear-gradient(145deg, #4778d9, #2852ac);
}

.module-card__dot {
  border-radius: 5rpx;
  background: #ffffff;
}

.module-card__copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  margin-left: 24rpx;
}

.module-card__title {
  color: #172033;
  font-size: 34rpx;
  font-weight: 700;
}

.module-card__meta {
  margin-top: 8rpx;
  color: #7a8190;
  font-size: 24rpx;
}

.module-card__arrow,
.workbench__manage-arrow {
  color: #626c7a;
  font-size: 54rpx;
  font-weight: 300;
}

.module-card__enter {
  display: flex;
  height: 88rpx;
  align-items: center;
  justify-content: space-between;
  padding: 0 26rpx;
  border: 2rpx solid #e2e6ed;
  border-radius: 16rpx;
  background: #ffffff;
  color: #26344a;
  font-size: 28rpx;
  text-align: left;
}

.module-card__enter-arrow {
  color: #52617a;
  font-size: 36rpx;
}

.workbench__manage,
.workbench__data-protection {
  display: flex;
  min-height: 96rpx;
  box-sizing: border-box;
  align-items: center;
  gap: 20rpx;
  margin-top: 28rpx;
  padding: 0 26rpx;
  border: 2rpx solid #3156a9;
  border-radius: 17rpx;
  background: transparent;
  color: #273653;
  font-size: 28rpx;
  text-align: left;
}

.workbench__data-protection {
  border-color: #d9dfe9;
  background: #ffffff;
}

.workbench__data-copy {
  display: flex;
  flex-direction: column;
}

.workbench__data-title {
  color: #273653;
  font-size: 27rpx;
  font-weight: 600;
}

.workbench__data-meta {
  margin-top: 7rpx;
  color: #7b8493;
  font-size: 21rpx;
}

.workbench__manage-arrow {
  margin-left: auto;
}
</style>
