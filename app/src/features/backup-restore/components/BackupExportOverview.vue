<script setup lang="ts">
import { computed } from "vue";
import AppIcon from "@/features/shared/components/AppIcon.vue";
import { formatLocalDateTime } from "@/utils/date-time-display";

const props = defineProps<{
  lastExportedAt?: string;
}>();

const exportValue = computed(() =>
  props.lastExportedAt
    ? formatLocalDateTime(props.lastExportedAt)
    : "尚未导出",
);
</script>

<template>
  <view class="export-overview">
    <view class="export-overview__ambient" aria-hidden="true" />
    <view class="export-overview__copy">
      <text class="export-overview__label">最近完整系统导出</text>
      <text class="export-overview__value">{{ exportValue }}</text>
      <text class="export-overview__hint">
        有业务数据后，建议每 7 天导出一次
      </text>
    </view>
    <view class="export-overview__icon" aria-hidden="true">
      <AppIcon name="history" :size="60" color="#566272" />
    </view>
  </view>
</template>

<style scoped>
.export-overview {
  position: relative;
  display: flex;
  min-height: 248rpx;
  box-sizing: border-box;
  align-items: center;
  justify-content: space-between;
  gap: 28rpx;
  margin-top: 42rpx;
  padding: 38rpx 38rpx 36rpx;
  overflow: hidden;
  border: 2rpx solid rgba(255, 255, 255, 0.84);
  border-radius: 36rpx;
  background: rgba(251, 250, 247, 0.62);
  box-shadow:
    0 30rpx 68rpx rgba(75, 63, 51, 0.14),
    0 7rpx 18rpx rgba(75, 63, 51, 0.07),
    inset 0 2rpx 0 rgba(255, 255, 255, 0.92);
  -webkit-backdrop-filter: blur(34rpx) saturate(1.16);
  backdrop-filter: blur(34rpx) saturate(1.16);
}

.export-overview__ambient {
  position: absolute;
  top: -100rpx;
  left: -70rpx;
  width: 300rpx;
  height: 300rpx;
  border-radius: 50%;
  background: rgba(183, 131, 140, 0.16);
  filter: blur(58rpx);
  pointer-events: none;
}

.export-overview__copy {
  position: relative;
  z-index: 1;
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.export-overview__label {
  color: #656862;
  font-size: 23rpx;
  letter-spacing: 1rpx;
}

.export-overview__value {
  margin-top: 24rpx;
  color: #4f514d;
  font-size: 42rpx;
  font-weight: 650;
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.export-overview__hint {
  margin-top: 24rpx;
  color: #777974;
  font-size: 22rpx;
  line-height: 1.5;
}

.export-overview__icon {
  position: relative;
  display: flex;
  width: 140rpx;
  height: 140rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  line-height: 0;
}

@media (max-width: 360px) {
  .export-overview {
    padding-right: 30rpx;
    padding-left: 30rpx;
  }

  .export-overview__icon {
    width: 130rpx;
    height: 130rpx;
  }
}
</style>
