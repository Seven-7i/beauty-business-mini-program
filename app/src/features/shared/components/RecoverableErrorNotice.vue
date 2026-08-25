<script setup lang="ts">
defineProps<{
  message: string;
  retryable?: boolean;
  retrying?: boolean;
}>();

defineEmits<{
  (event: "retry"): void;
}>();
</script>

<template>
  <view class="error-notice" role="alert">
    <view class="error-notice__copy">
      <text class="error-notice__title">
        {{ retryable ? "本机数据暂时无法读取" : "操作未完成" }}
      </text>
      <text class="error-notice__message">{{ message }}</text>
    </view>
    <button
      v-if="retryable"
      class="error-notice__retry"
      :disabled="retrying"
      @click="$emit('retry')"
    >
      {{ retrying ? "正在重试" : "重新读取" }}
    </button>
  </view>
</template>

<style scoped>
.error-notice {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
  margin-top: 20rpx;
  padding: 20rpx;
  border: 2rpx solid #e2b5b5;
  border-radius: 13rpx;
  background: #fff5f4;
}

.error-notice__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.error-notice__title,
.error-notice__message {
  display: block;
  overflow-wrap: anywhere;
}

.error-notice__title {
  color: #7f3633;
  font-size: 23rpx;
  font-weight: 700;
}

.error-notice__message {
  margin-top: 7rpx;
  color: #97423f;
  font-size: 21rpx;
  line-height: 1.55;
}

.error-notice__retry {
  flex: none;
  min-height: 68rpx;
  padding: 12rpx 18rpx;
  border: 2rpx solid #d6a29f;
  border-radius: 10rpx;
  background: #ffffff;
  color: #873d39;
  font-size: 21rpx;
  line-height: 1.35;
}

@media (max-width: 360px) {
  .error-notice {
    flex-direction: column;
  }

  .error-notice__retry {
    width: 100%;
  }
}
</style>
