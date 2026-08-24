<script setup lang="ts">
const props = defineProps<{
  message: string;
}>();

const emit = defineEmits<{
  (event: "retry"): void;
}>();
</script>

<template>
  <view class="data-error">
    <view class="data-error__symbol">!</view>
    <text class="data-error__eyebrow">只读保护</text>
    <text class="data-error__title">暂时不能进入工作台</text>
    <text class="data-error__message">{{ props.message }}</text>
    <button class="data-error__button" @click="emit('retry')">
      重新检查本机数据
    </button>
  </view>
</template>

<style scoped>
.data-error {
  display: flex;
  min-height: calc(100vh - 88rpx);
  box-sizing: border-box;
  flex-direction: column;
  align-items: center;
  padding: 110rpx 48rpx calc(48rpx + env(safe-area-inset-bottom));
  text-align: center;
}

.data-error__symbol {
  display: flex;
  width: 88rpx;
  height: 88rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #fff2e2;
  color: #aa681d;
  font-size: 48rpx;
  font-weight: 700;
}

.data-error__eyebrow {
  margin-top: 34rpx;
  color: #9a641d;
  font-size: 24rpx;
  font-weight: 600;
}

.data-error__title {
  margin-top: 16rpx;
  color: #172033;
  font-size: 40rpx;
  font-weight: 700;
}

.data-error__message {
  max-width: 620rpx;
  margin-top: 20rpx;
  color: #687183;
  font-size: 26rpx;
  line-height: 1.7;
}

.data-error__button {
  display: flex;
  width: 100%;
  min-height: 94rpx;
  align-items: center;
  justify-content: center;
  margin-top: 48rpx;
  border-radius: 17rpx;
  background: #3159b5;
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 600;
}

</style>
