<script setup lang="ts">
defineEmits<{
  (event: "continue"): void;
}>();
</script>

<template>
  <view class="success">
    <view class="success__mark">
      <view class="success__check" />
    </view>
    <text class="success__title">已开启：美容</text>
    <text class="success__description">
      现在可以进入美容模块，管理顾客、项目和预约。
    </text>
    <button class="success__button" @click="$emit('continue')">进入美容</button>
  </view>
</template>

<style scoped>
.success {
  display: flex;
  min-height: calc(100vh - 88rpx);
  box-sizing: border-box;
  align-items: center;
  flex-direction: column;
  padding: 130rpx 54rpx calc(58rpx + env(safe-area-inset-bottom));
  text-align: center;
}

.success__mark {
  display: flex;
  width: 180rpx;
  height: 180rpx;
  align-items: center;
  justify-content: center;
  border: 24rpx solid #e5f5f2;
  border-radius: 50%;
  background: linear-gradient(145deg, #3bc2ad, #15998c);
  box-shadow: 0 18rpx 40rpx rgba(24, 153, 140, 0.2);
}

.success__check {
  width: 62rpx;
  height: 32rpx;
  margin-top: -12rpx;
  transform: rotate(-45deg);
  border-bottom: 12rpx solid #ffffff;
  border-left: 12rpx solid #ffffff;
  border-radius: 5rpx;
}

.success__title {
  margin-top: 70rpx;
  color: #111827;
  font-size: 48rpx;
  font-weight: 700;
}

.success__description {
  max-width: 520rpx;
  margin-top: 28rpx;
  color: #5f6878;
  font-size: 29rpx;
  line-height: 1.75;
}

.success__button {
  display: flex;
  width: 100%;
  height: 104rpx;
  align-items: center;
  justify-content: center;
  margin-top: auto;
  border-radius: 18rpx;
  background: linear-gradient(135deg, #3562c9, #243f9f);
  box-shadow: 0 14rpx 30rpx rgba(37, 64, 159, 0.2);
  color: #ffffff;
  font-size: 31rpx;
  font-weight: 600;
}
</style>
