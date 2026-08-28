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

const usedText = computed(() => {
  const currentSizeKb = props.capacity?.currentSizeKb;
  if (currentSizeKb === undefined) {
    return props.loading ? "读取中" : "暂不可用";
  }
  if (currentSizeKb < 1024) {
    return `${Math.max(0, Math.round(currentSizeKb))} KB`;
  }
  return `${(currentSizeKb / 1024).toFixed(2)} MB`;
});

const progressStyle = computed(() => ({
  width: `${Math.min(100, props.capacity?.usedPercentOfTarget ?? 0).toFixed(1)}%`,
}));

const announcedValue = computed(() =>
  Math.min(
    props.capacity?.currentSizeKb ?? 0,
    props.capacity?.targetSizeKb ?? 7168,
  ),
);

const targetReached = computed(
  () => props.capacity?.status === "target-reached",
);

const statusText = computed(() => {
  if (!props.capacity) {
    return props.loading ? "正在读取" : "状态未知";
  }
  return targetReached.value ? "需要处理" : "空间充足";
});
</script>

<template>
  <view
    class="storage-card"
    :class="{ 'storage-card--warning': targetReached }"
  >
    <view class="storage-card__ambient" aria-hidden="true" />

    <view class="storage-card__heading">
      <view class="storage-card__identity">
        <view class="storage-card__copy">
          <text class="storage-card__eyebrow">本机存储</text>
          <text class="storage-card__value">已使用 {{ usedText }}</text>
        </view>
      </view>

      <button
        class="storage-card__manage"
        :disabled="loading"
        hover-class="storage-card__manage--pressed"
        @click="$emit('cleanup')"
      >
        管理空间
      </button>
    </view>

    <view
      class="storage-card__track"
      role="progressbar"
      aria-label="本机存储占用"
      :aria-valuenow="announcedValue"
      :aria-valuemax="capacity?.targetSizeKb ?? 7168"
      :aria-valuetext="`已使用 ${usedText}`"
    >
      <view class="storage-card__progress" :style="progressStyle" />
    </view>

    <view class="storage-card__status">
      <text class="storage-card__status-text">{{ statusText }}</text>
      <text class="storage-card__target">建议为备份与恢复预留空间</text>
    </view>

    <view v-if="targetReached" class="storage-card__warning" role="alert">
      <text class="storage-card__warning-title">本机数据已达到 7MB 建议上限</text>
      <text class="storage-card__warning-copy">
        请先导出完整备份，再手动清理不再需要的预约历史。系统不会自动删除数据。
      </text>
      <button
        class="storage-card__backup"
        :disabled="loading"
        hover-class="storage-card__backup--pressed"
        @click="$emit('backup')"
      >
        先导出备份
      </button>
    </view>
  </view>
</template>

<style scoped>
.storage-card {
  position: relative;
  margin-top: 42rpx;
  padding: 34rpx 32rpx 30rpx;
  overflow: hidden;
  border: 2rpx solid rgba(255, 255, 255, 0.82);
  border-radius: 34rpx;
  background: rgba(251, 250, 247, 0.62);
  box-shadow:
    0 30rpx 64rpx rgba(75, 63, 51, 0.14),
    0 6rpx 16rpx rgba(75, 63, 51, 0.07),
    inset 0 2rpx 0 rgba(255, 255, 255, 0.9);
  -webkit-backdrop-filter: blur(32rpx) saturate(1.16);
  backdrop-filter: blur(32rpx) saturate(1.16);
}

.storage-card--warning {
  border-color: rgba(183, 131, 140, 0.48);
}

.storage-card__ambient {
  position: absolute;
  top: -90rpx;
  right: -70rpx;
  width: 250rpx;
  height: 250rpx;
  border-radius: 50%;
  background: rgba(188, 164, 127, 0.2);
  filter: blur(54rpx);
  pointer-events: none;
}

.storage-card__heading,
.storage-card__identity,
.storage-card__status {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
}

.storage-card__heading {
  justify-content: space-between;
  gap: 24rpx;
}

.storage-card__identity {
  min-width: 0;
  flex: 1;
}

.storage-card__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.storage-card__eyebrow {
  color: #73756f;
  font-size: 21rpx;
  letter-spacing: 2rpx;
}

.storage-card__value {
  margin-top: 8rpx;
  color: #242620;
  font-size: 31rpx;
  font-weight: 650;
  line-height: 1.2;
}

.storage-card__manage {
  min-height: 68rpx;
  flex: none;
  padding: 0 4rpx;
  background: transparent;
  color: #3d4a5d;
  font-size: 23rpx;
  font-weight: 550;
  line-height: 68rpx;
  transition: opacity 160ms ease;
}

.storage-card__manage--pressed {
  opacity: 0.56;
}

.storage-card__track {
  position: relative;
  z-index: 1;
  height: 10rpx;
  margin-top: 34rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: rgba(61, 74, 93, 0.1);
  box-shadow: inset 0 2rpx 5rpx rgba(64, 57, 48, 0.08);
}

.storage-card__progress {
  height: 100%;
  border-radius: inherit;
  background: #3d4a5d;
  transition: width 220ms ease;
}

.storage-card--warning .storage-card__progress {
  background: #a85f67;
}

.storage-card__status {
  justify-content: space-between;
  gap: 20rpx;
  margin-top: 16rpx;
}

.storage-card__status-text {
  flex: none;
  color: #556359;
  font-size: 21rpx;
  font-weight: 600;
}

.storage-card--warning .storage-card__status-text {
  color: #8a4d53;
}

.storage-card__target {
  color: #85847e;
  font-size: 20rpx;
  line-height: 1.45;
  text-align: right;
}

.storage-card__warning {
  position: relative;
  z-index: 1;
  margin-top: 26rpx;
  padding: 22rpx;
  border: 2rpx solid rgba(183, 131, 140, 0.26);
  border-radius: 22rpx;
  background: rgba(255, 246, 244, 0.62);
}

.storage-card__warning-title,
.storage-card__warning-copy {
  display: block;
}

.storage-card__warning-title {
  color: #77464b;
  font-size: 23rpx;
  font-weight: 650;
}

.storage-card__warning-copy {
  margin-top: 10rpx;
  color: #80676a;
  font-size: 21rpx;
  line-height: 1.55;
}

.storage-card__backup {
  min-height: 72rpx;
  margin-top: 20rpx;
  border-radius: 18rpx;
  background: #3d4a5d;
  color: #f8f6f1;
  font-size: 23rpx;
  font-weight: 600;
  transition: opacity 160ms ease, transform 160ms ease;
}

.storage-card__backup--pressed {
  opacity: 0.78;
  transform: scale(0.985);
}

@media (max-width: 360px) {
  .storage-card {
    padding-right: 26rpx;
    padding-left: 26rpx;
  }

  .storage-card__heading {
    align-items: flex-start;
  }

  .storage-card__manage {
    min-height: 58rpx;
    line-height: 58rpx;
  }
}
</style>
