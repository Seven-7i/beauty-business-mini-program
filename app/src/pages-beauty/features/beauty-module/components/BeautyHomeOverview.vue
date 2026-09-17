<script setup lang="ts">
import { computed } from "vue";
import type { DeepReadonly } from "vue";
import type { BeautyHomeOverview } from "@/services/statistics-service";

const props = defineProps<{
  overview?: DeepReadonly<BeautyHomeOverview>;
  loading: boolean;
  errorMessage: string;
}>();

function formatCurrency(cents: number): string {
  const [integerPart, decimalPart] = (cents / 100).toFixed(2).split(".");
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimalPart === "00" ? `¥${grouped}` : `¥${grouped}.${decimalPart}`;
}

const metrics = computed(() => {
  const unavailable = props.loading || Boolean(props.errorMessage) || !props.overview;
  return [
    {
      id: "completed",
      label: "本月完成",
      value: unavailable ? "—" : String(props.overview?.monthlyCompletedCount ?? 0),
    },
    {
      id: "transaction",
      label: "本月成交",
      value: unavailable
        ? "—"
        : formatCurrency(props.overview?.monthlyTransactionAmountCents ?? 0),
    },
    {
      id: "pending",
      label: "待执行",
      value: unavailable ? "—" : String(props.overview?.pendingCount ?? 0),
    },
  ];
});
</script>

<template>
  <view
    class="overview-card"
    aria-label="本月经营概览"
    :aria-busy="loading ? 'true' : undefined"
  >
    <view
      v-for="metric in metrics"
      :key="metric.id"
      class="overview-card__metric"
      :class="`overview-card__metric--${metric.id}`"
    >
      <text class="overview-card__label">{{ metric.label }}</text>
      <text class="overview-card__value">{{ metric.value }}</text>
    </view>
  </view>
</template>

<style scoped>
.overview-card {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr 1.5fr 1fr;
  min-height: 196rpx;
  overflow: hidden;
  border: 2rpx solid rgba(255, 255, 255, 0.9);
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 22rpx 52rpx rgba(146, 96, 128, 0.12);
  backdrop-filter: blur(24rpx);
}

.overview-card__metric {
  position: relative;
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
  padding: 30rpx 12rpx 28rpx;
  flex-direction: column;
  text-align: center;
}

.overview-card__metric + .overview-card__metric::before {
  position: absolute;
  top: 42rpx;
  bottom: 42rpx;
  left: 0;
  width: 2rpx;
  background: rgba(139, 120, 140, 0.12);
  content: "";
}

.overview-card__label {
  color: #706a72;
  font-size: 23rpx;
  line-height: 1.35;
}

.overview-card__value {
  max-width: 100%;
  margin-top: 18rpx;
  color: #9361a0;
  font-size: 40rpx;
  font-weight: 700;
  line-height: 1.08;
  overflow-wrap: anywhere;
}

.overview-card__metric--transaction .overview-card__value {
  font-size: 38rpx;
}

.overview-card__metric--pending .overview-card__value {
  color: #4e9a72;
}

@media (max-width: 360px) {
  .overview-card__label {
    font-size: 21rpx;
  }

  .overview-card__value,
  .overview-card__metric--transaction .overview-card__value {
    font-size: 34rpx;
  }
}
</style>
