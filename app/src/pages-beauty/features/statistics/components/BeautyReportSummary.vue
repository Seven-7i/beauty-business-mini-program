<script setup lang="ts">
import { computed } from "vue";
import type { DeepReadonly } from "vue";
import type { BeautyHomeOverview } from "@/services/statistics-service";

const props = defineProps<{
  overview?: DeepReadonly<BeautyHomeOverview>;
  month: Date;
  canSelectNextMonth: boolean;
}>();

const emit = defineEmits<{
  (event: "previousMonth"): void;
  (event: "nextMonth"): void;
}>();

/** 将本地月份格式化为图稿使用的“2026年9月”形式。 */
function formatReportMonth(value: Date): string {
  return `${value.getFullYear()}年${value.getMonth() + 1}月`;
}

/** 将分转换为报表汇总卡使用的人民币文本。 */
function formatStatisticsCurrency(cents: number): string {
  const fixed = (cents / 100).toFixed(2);
  return fixed.endsWith(".00") ? `¥${fixed.slice(0, -3)}` : `¥${fixed}`;
}

const monthLabel = computed(() => formatReportMonth(props.month));
const averageTransaction = computed(() => {
  const count = props.overview?.monthlyCompletedCount ?? 0;
  return count > 0
    ? Math.round((props.overview?.monthlyTransactionAmountCents ?? 0) / count)
    : 0;
});
const changeLabel = computed(() => {
  const change = props.overview?.monthlyTransactionChangePercent;
  if (change === undefined) return "—";
  return `${change >= 0 ? "+" : ""}${change}%`;
});
const changeTone = computed(() => {
  const change = props.overview?.monthlyTransactionChangePercent;
  if (change === undefined || change === 0) return "neutral";
  return change > 0 ? "up" : "down";
});

/** 当前月不允许继续向未来切换，避免展示不存在的未来经营数据。 */
function selectNextMonth(): void {
  if (props.canSelectNextMonth) emit("nextMonth");
}
</script>

<template>
  <view class="report-summary-section">
    <view class="report-month" aria-label="统计月份选择器">
      <view
        class="report-month__arrow report-month__arrow--previous"
        role="button"
        tabindex="0"
        aria-label="上一个月"
        hover-class="report-month__arrow--pressed"
        @tap="emit('previousMonth')"
        @keyup.enter="emit('previousMonth')"
        @keyup.space.prevent="emit('previousMonth')"
      >
        <view class="report-month__chevron report-month__chevron--previous" />
      </view>
      <text class="report-month__label">{{ monthLabel }}</text>
      <view
        class="report-month__arrow"
        :class="{ 'report-month__arrow--disabled': !canSelectNextMonth }"
        role="button"
        :tabindex="canSelectNextMonth ? 0 : -1"
        aria-label="下一个月"
        :aria-disabled="!canSelectNextMonth"
        hover-class="report-month__arrow--pressed"
        @tap="selectNextMonth"
        @keyup.enter="selectNextMonth"
        @keyup.space.prevent="selectNextMonth"
      >
        <view class="report-month__chevron report-month__chevron--next" />
      </view>
    </view>

    <view class="report-summary" aria-label="本月经营汇总">
      <view class="report-summary__metric">
        <text class="report-summary__label">已完成</text>
        <text class="report-summary__value">{{ overview?.monthlyCompletedCount ?? 0 }}<text class="report-summary__unit"> 单</text></text>
      </view>
      <view class="report-summary__metric">
        <text class="report-summary__label">成交金额</text>
        <text class="report-summary__value">{{ formatStatisticsCurrency(overview?.monthlyTransactionAmountCents ?? 0) }}</text>
      </view>
      <view class="report-summary__metric">
        <text class="report-summary__label">客单价</text>
        <text class="report-summary__value">{{ formatStatisticsCurrency(averageTransaction) }}</text>
      </view>
      <view class="report-summary__metric report-summary__metric--change">
        <text class="report-summary__label">较上月</text>
        <text
          class="report-summary__value"
          :class="`report-summary__value--${changeTone}`"
        >{{ changeLabel }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.report-summary-section { display: flex; flex-direction: column; }
.report-month { display: grid; width: 268rpx; height: 60rpx; box-sizing: border-box; grid-template-columns: 52rpx minmax(0, 1fr) 52rpx; align-items: center; align-self: center; border: 2rpx solid #dfd0f6; border-radius: 32rpx; background: linear-gradient(135deg, #f8f3ff 0%, #eee5fb 100%); box-shadow: inset 0 2rpx 0 rgba(255, 255, 255, 0.78); color: #241b36; }
.report-month__label { display: block; align-self: center; font-size: 30rpx; font-weight: 600; line-height: 30rpx; text-align: center; white-space: nowrap; }
.report-month__arrow { display: flex; width: 52rpx; height: 52rpx; align-items: center; justify-content: center; align-self: center; border-radius: 50%; color: #241b36; }
.report-month__chevron { width: 12rpx; height: 12rpx; box-sizing: border-box; border-top: 2rpx solid currentColor; border-right: 2rpx solid currentColor; transform-origin: center; }
.report-month__chevron--previous { transform: rotate(-135deg); }
.report-month__chevron--next { transform: rotate(45deg); }
.report-month__arrow--pressed { background: rgba(143, 114, 200, 0.1); }
.report-month__arrow--disabled { opacity: 0.28; }
.report-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); min-height: 178rpx; margin-top: 28rpx; overflow: hidden; border: 2rpx solid #f7f1ff; border-radius: 28rpx; background: linear-gradient(135deg, #f2e8fd 0%, #ece3f9 100%); box-shadow: 0 18rpx 48rpx rgba(142, 99, 135, 0.09); }
.report-summary__metric { position: relative; display: flex; min-width: 0; align-items: center; justify-content: center; padding: 28rpx 8rpx 26rpx; flex-direction: column; text-align: center; }
.report-summary__metric + .report-summary__metric::before { position: absolute; top: 40rpx; bottom: 40rpx; left: 0; width: 2rpx; background: rgba(143, 114, 200, 0.15); content: ""; }
.report-summary__label { color: #756d7d; font-size: 22rpx; line-height: 1.3; }
.report-summary__value { max-width: 100%; margin-top: 16rpx; color: #21182f; font-size: 42rpx; font-weight: 720; line-height: 1; white-space: nowrap; }
.report-summary__unit { font-size: 25rpx; font-weight: 500; }
.report-summary__value--up { color: #d85d66; }
.report-summary__value--down { color: #55a66a; }
.report-summary__value--neutral { color: #756d7d; }
@media (max-width: 360px) { .report-summary__value { font-size: 36rpx; } .report-summary__label { font-size: 20rpx; } }
</style>
