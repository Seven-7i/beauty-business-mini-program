<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { AppointmentV1 } from "@/domain/data-schema";
import { formatCustomerCurrency } from "../customer-currency";

defineProps<{
  appointments: readonly DeepReadonly<AppointmentV1>[];
}>();

/** 历史预约列表向顾客详情组合层暴露的导航动作。 */
const emit = defineEmits<{
  /** 请求打开指定预约的独立详情页。 */
  "open-detail": [appointmentId: string];
}>();

function formatSchedule(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function isOverdue(appointment: DeepReadonly<AppointmentV1>): boolean {
  return (
    appointment.status === "pending" &&
    new Date(appointment.scheduledAt).getTime() < Date.now()
  );
}

function statusLabel(appointment: DeepReadonly<AppointmentV1>): string {
  if (isOverdue(appointment)) {
    return "已逾期";
  }
  return appointment.status === "pending"
    ? "待执行"
    : appointment.status === "completed"
      ? "已完成"
      : "已取消";
}
</script>

<template>
  <view class="customer-history" aria-label="顾客预约历史">
    <view v-if="!appointments.length" class="customer-history__empty" role="status">
      这位顾客还没有预约记录。
    </view>
    <template v-else>
      <view
        v-for="appointment in appointments"
        :key="appointment.id"
        class="history-card"
        role="button"
        tabindex="0"
        :aria-label="`查看${appointment.projectSnapshots.map((project) => project.name).join('、')}的预约详情`"
        hover-class="history-card--pressed"
        @click="emit('open-detail', appointment.id)"
        @keyup.enter="emit('open-detail', appointment.id)"
        @keyup.space.prevent="emit('open-detail', appointment.id)"
      >
        <view class="history-card__heading">
          <text class="history-card__status" :class="isOverdue(appointment) ? 'history-card__status--overdue' : `history-card__status--${appointment.status}`">
            {{ statusLabel(appointment) }}
          </text>
          <text class="history-card__time">{{ formatSchedule(appointment.scheduledAt) }}</text>
        </view>
        <text class="history-card__projects">{{ appointment.projectSnapshots.map((project) => project.name).join("、") }}</text>
        <view class="history-card__summary">
          <view class="history-card__metric">
            <text class="history-card__metric-label">预计时长</text>
            <text class="history-card__metric-value">{{ appointment.estimatedDurationMinutes }} 分钟</text>
          </view>
          <view class="history-card__divider" aria-hidden="true" />
          <view class="history-card__metric">
            <text class="history-card__metric-label">标准金额</text>
            <text class="history-card__metric-value">{{ formatCustomerCurrency(appointment.standardAmountCents) }}</text>
          </view>
        </view>
        <text v-if="appointment.status === 'completed'" class="history-card__result">
          成交 {{ formatCustomerCurrency(appointment.transactionAmountCents) }} · 完成于 {{ formatSchedule(appointment.completedAt) }}
        </text>
        <text v-else-if="appointment.status === 'cancelled'" class="history-card__result">
          取消于 {{ formatSchedule(appointment.cancelledAt) }}{{ appointment.cancelReason ? ` · ${appointment.cancelReason}` : "" }}
        </text>
        <view class="history-card__footer">
          <text>查看预约详情</text>
          <u-icon name="arrow-right" color="#6A3CB3" size="17" />
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped>
.history-card__heading, .history-card__summary, .history-card__metric, .history-card__footer { display: flex; align-items: center; }
.customer-history__empty { padding: 42rpx 24rpx; border: 2rpx dashed #ded3dc; border-radius: 22rpx; background: rgba(255, 253, 253, 0.82); color: #746d72; font-size: 25rpx; line-height: 1.55; text-align: center; }
.history-card { margin-top: 20rpx; padding: 28rpx; border: 2rpx solid rgba(136, 103, 126, 0.12); border-radius: 24rpx; background: rgba(255, 255, 255, 0.97); box-shadow: 0 12rpx 30rpx rgba(111, 76, 99, 0.07); transition: transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease; }
.history-card:first-child { margin-top: 0; }
.history-card--pressed { border-color: rgba(106, 60, 179, 0.24); box-shadow: 0 6rpx 18rpx rgba(111, 76, 99, 0.08); transform: scale(0.988); }
.history-card__heading { justify-content: space-between; gap: 18rpx; }
.history-card__projects { display: block; margin-top: 22rpx; color: #2b252a; font-size: 30rpx; font-weight: 700; line-height: 1.45; overflow-wrap: anywhere; }
.history-card__status { flex: none; padding: 8rpx 14rpx; border-radius: 10rpx; font-size: 22rpx; font-weight: 600; }
.history-card__status--pending { background: #f0eafa; color: #6337ae; }
.history-card__status--overdue { background: #fae9e7; color: #984943; }
.history-card__status--completed { background: #e5f2ea; color: #34704d; }
.history-card__status--cancelled { background: #eceef2; color: #737d8d; }
.history-card__time { min-width: 0; color: #514a50; font-size: 25rpx; font-weight: 600; font-variant-numeric: tabular-nums; text-align: right; }
.history-card__summary { gap: 20rpx; margin-top: 22rpx; padding: 20rpx 22rpx; border-radius: 16rpx; background: #faf7fb; }
.history-card__metric { min-width: 0; flex: 1; flex-direction: column; align-items: flex-start; gap: 6rpx; }
.history-card__metric-label { color: #827980; font-size: 22rpx; }
.history-card__metric-value { color: #3f373d; font-size: 26rpx; font-weight: 650; font-variant-numeric: tabular-nums; }
.history-card__divider { width: 2rpx; height: 50rpx; flex: none; background: rgba(116, 96, 111, 0.14); }
.history-card__result { display: block; margin-top: 16rpx; color: #554d53; font-size: 24rpx; line-height: 1.55; overflow-wrap: anywhere; }
.history-card__footer { justify-content: flex-end; gap: 6rpx; margin-top: 22rpx; padding-top: 18rpx; border-top: 2rpx solid rgba(125, 100, 118, 0.1); color: #6a3cb3; font-size: 24rpx; font-weight: 650; }
@media (max-width: 360px) { .history-card { padding: 24rpx; } .history-card__time { font-size: 23rpx; } .history-card__summary { padding-right: 18rpx; padding-left: 18rpx; } }
</style>
