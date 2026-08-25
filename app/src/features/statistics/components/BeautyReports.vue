<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { BeautyHomeOverview } from "@/services/statistics-service";
import RecoverableErrorNotice from "@/features/shared/components/RecoverableErrorNotice.vue";

defineProps<{
  overview?: DeepReadonly<BeautyHomeOverview>;
  loading: boolean;
  errorMessage: string;
}>();

defineEmits<{
  (event: "retry"): void;
}>();

function formatCurrency(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}
</script>

<template>
  <view class="reports-panel">
    <view class="reports-panel__intro">
      <text class="reports-panel__eyebrow">经营概览</text>
      <text class="reports-panel__title">报表</text>
      <text class="reports-panel__description">只按未删除的已完成预约汇总，不记录支出、成本或利润。</text>
    </view>
    <view v-if="loading" class="reports-panel__state">正在读取本机经营数据</view>
    <RecoverableErrorNotice
      v-else-if="errorMessage"
      :message="errorMessage"
      retryable
      @retry="$emit('retry')"
    />
    <view v-else class="reports-panel__cards">
      <view class="report-card report-card--primary">
        <text class="report-card__label">本月成交金额</text>
        <text class="report-card__value">{{ formatCurrency(overview?.monthlyTransactionAmountCents ?? 0) }}</text>
        <text class="report-card__meta">按实际完成时间归属当前本地自然月</text>
      </view>
      <view class="report-card">
        <text class="report-card__label">本月完成预约</text>
        <text class="report-card__value">{{ overview?.monthlyCompletedCount ?? 0 }} 次</text>
      </view>
      <view class="report-card">
        <text class="report-card__label">当前待执行</text>
        <text class="report-card__value">{{ overview?.pendingCount ?? 0 }} 条</text>
      </view>
    </view>
    <view class="reports-panel__note">删除已完成预约后不再计入统计；更正成交金额或实际完成时间后，返回本页会重新计算。</view>
  </view>
</template>

<style scoped>
.reports-panel { min-height: calc(100vh - 88rpx); box-sizing: border-box; padding: 44rpx 28rpx calc(150rpx + env(safe-area-inset-bottom)); }
.reports-panel__intro { display: flex; padding: 0 8rpx; flex-direction: column; }
.reports-panel__eyebrow { color: #31549e; font-size: 22rpx; font-weight: 600; }
.reports-panel__title { margin-top: 10rpx; color: #1a2538; font-size: 42rpx; font-weight: 700; }
.reports-panel__description { margin-top: 12rpx; color: #737e90; font-size: 22rpx; line-height: 1.6; }
.reports-panel__state { margin-top: 28rpx; padding: 28rpx; border: 2rpx dashed #d6dce5; border-radius: 16rpx; color: #788395; font-size: 22rpx; text-align: center; }
.reports-panel__cards { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; margin-top: 30rpx; }
.report-card { display: flex; min-width: 0; padding: 28rpx 24rpx; border: 2rpx solid #dfe4eb; border-radius: 20rpx; background: #fff; flex-direction: column; }
.report-card--primary { grid-column: 1 / -1; background: linear-gradient(135deg, #43536d, #263650); color: #fff; }
.report-card__label { color: #758092; font-size: 21rpx; }
.report-card--primary .report-card__label { color: rgba(255, 255, 255, 0.75); }
.report-card__value { margin-top: 13rpx; color: #263650; font-size: 38rpx; font-weight: 700; line-height: 1.2; overflow-wrap: anywhere; }
.report-card--primary .report-card__value { color: #fff; font-size: 48rpx; }
.report-card__meta { margin-top: 12rpx; color: rgba(255, 255, 255, 0.7); font-size: 19rpx; }
.reports-panel__note { margin-top: 22rpx; padding: 22rpx; border-radius: 14rpx; background: #eef2f7; color: #687487; font-size: 20rpx; line-height: 1.6; }

@media (max-width: 360px) {
  .reports-panel__cards {
    grid-template-columns: 1fr;
  }

  .report-card--primary {
    grid-column: auto;
  }
}
</style>
