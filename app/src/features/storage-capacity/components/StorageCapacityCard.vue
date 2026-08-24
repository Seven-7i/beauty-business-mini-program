<script setup lang="ts">
import { computed, type DeepReadonly } from "vue";
import type { StorageCapacitySummary } from "@/services/storage-capacity-service";

const props = defineProps<{
  capacity?: DeepReadonly<StorageCapacitySummary>;
  loading: boolean;
}>();

defineEmits<{
  (event: "backup"): void;
  (event: "cleanup"): void;
}>();

const usedText = computed(() =>
  props.capacity
    ? `${(props.capacity.currentSizeKb / 1024).toFixed(2)}MB`
    : "--",
);
const limitText = computed(() =>
  props.capacity
    ? `${(props.capacity.limitSizeKb / 1024).toFixed(0)}MB`
    : "--",
);
const progressStyle = computed(() => ({
  width: `${Math.min(100, props.capacity?.usedPercentOfTarget ?? 0).toFixed(1)}%`,
}));
const targetReached = computed(
  () => props.capacity?.status === "target-reached",
);
const statusText = computed(() => {
  if (!props.capacity) {
    return props.loading ? "读取中" : "暂不可用";
  }
  return targetReached.value ? "需要处理" : "正常";
});
</script>

<template>
  <view
    class="storage-card"
    :class="{ 'storage-card--warning': targetReached }"
  >
    <view class="storage-card__heading">
      <view class="storage-card__copy">
        <text class="storage-card__title">本机存储</text>
        <text class="storage-card__meta">
          已使用 {{ usedText }} · 设备上限 {{ limitText }}
        </text>
      </view>
      <text class="storage-card__badge">
        {{ statusText }}
      </text>
    </view>

    <view
      class="storage-card__track"
      role="progressbar"
      aria-label="本机存储占用"
      :aria-valuenow="capacity?.currentSizeKb ?? 0"
      :aria-valuemax="capacity?.targetSizeKb ?? 7168"
    >
      <view class="storage-card__progress" :style="progressStyle" />
    </view>
    <text class="storage-card__target">产品建议上限 7MB，为备份、恢复和写入预留空间</text>

    <view v-if="targetReached" class="storage-card__notice" role="alert">
      已达到 7MB。请先导出完整备份，再手动清理不再需要的预约历史；系统不会自动删除数据。
    </view>

    <view class="storage-card__actions">
      <button
        v-if="targetReached"
        class="storage-card__button storage-card__button--primary"
        :disabled="loading"
        @click="$emit('backup')"
      >
        先导出备份
      </button>
      <button
        class="storage-card__button"
        :disabled="loading"
        @click="$emit('cleanup')"
      >
        管理预约历史
      </button>
    </view>
  </view>
</template>

<style scoped>
.storage-card {
  margin-top: 36rpx;
  padding: 28rpx;
  border: 2rpx solid #dce2ea;
  border-radius: 22rpx;
  background: #ffffff;
}

.storage-card--warning {
  border-color: #dfaaa5;
  background: #fffafa;
}

.storage-card__heading,
.storage-card__actions {
  display: flex;
  align-items: center;
}

.storage-card__heading {
  justify-content: space-between;
  gap: 20rpx;
}

.storage-card__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.storage-card__title {
  color: #202a3b;
  font-size: 28rpx;
  font-weight: 700;
}

.storage-card__meta,
.storage-card__target {
  color: #757f90;
  font-size: 21rpx;
  line-height: 1.5;
}

.storage-card__meta {
  margin-top: 7rpx;
}

.storage-card__badge {
  flex: none;
  padding: 7rpx 12rpx;
  border-radius: 9rpx;
  background: #e8f1ec;
  color: #38674f;
  font-size: 19rpx;
  font-weight: 600;
}

.storage-card--warning .storage-card__badge {
  background: #f8e7e5;
  color: #91443f;
}

.storage-card__track {
  height: 14rpx;
  margin-top: 24rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: #e9edf2;
}

.storage-card__progress {
  height: 100%;
  border-radius: inherit;
  background: #3d65b8;
}

.storage-card--warning .storage-card__progress {
  background: #a24c47;
}

.storage-card__target {
  display: block;
  margin-top: 12rpx;
}

.storage-card__notice {
  margin-top: 20rpx;
  padding: 18rpx;
  border-radius: 13rpx;
  background: #fae9e7;
  color: #873f3b;
  font-size: 22rpx;
  line-height: 1.55;
}

.storage-card__actions {
  gap: 14rpx;
  margin-top: 22rpx;
  flex-wrap: wrap;
}

.storage-card__button {
  min-height: 72rpx;
  margin: 0;
  padding: 0 22rpx;
  border: 2rpx solid #d5dce6;
  border-radius: 12rpx;
  background: #ffffff;
  color: #3c4a61;
  font-size: 22rpx;
  line-height: 68rpx;
}

.storage-card__button--primary {
  border-color: #3159b5;
  background: #3159b5;
  color: #ffffff;
}
</style>
