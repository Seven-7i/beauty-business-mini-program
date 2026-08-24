<script setup lang="ts">
defineProps<{
  eyebrow: string;
  title: string;
  description: string;
}>();
</script>

<template>
  <view class="coming-soon">
    <text class="coming-soon__eyebrow">{{ eyebrow }}</text>
    <text class="coming-soon__title">{{ title }}</text>
    <view class="coming-soon__card">
      <text class="coming-soon__mark">···</text>
      <text class="coming-soon__description">{{ description }}</text>
      <text class="coming-soon__status">将在核心业务阶段开放</text>
    </view>
  </view>
</template>

<style scoped>
.coming-soon {
  min-height: calc(100vh - 190rpx);
  box-sizing: border-box;
  padding: 48rpx 32rpx 150rpx;
}

.coming-soon__eyebrow,
.coming-soon__title,
.coming-soon__description,
.coming-soon__status {
  display: block;
}

.coming-soon__eyebrow {
  color: #31549e;
  font-size: 23rpx;
  font-weight: 600;
}

.coming-soon__title {
  margin-top: 14rpx;
  color: #172033;
  font-size: 43rpx;
  font-weight: 700;
}

.coming-soon__card {
  margin-top: 44rpx;
  padding: 70rpx 38rpx;
  border: 2rpx solid #e0e4eb;
  border-radius: 24rpx;
  background: #ffffff;
  text-align: center;
}

.coming-soon__mark {
  color: #5372b4;
  font-size: 58rpx;
  letter-spacing: 10rpx;
}

.coming-soon__description {
  margin-top: 24rpx;
  color: #515b6d;
  font-size: 27rpx;
  line-height: 1.7;
}

.coming-soon__status {
  margin-top: 18rpx;
  color: #9299a5;
  font-size: 22rpx;
}
</style>
