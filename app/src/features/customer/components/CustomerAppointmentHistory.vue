<script setup lang="ts">
import { shallowRef, type DeepReadonly } from "vue";
import type { AppointmentV1 } from "@/domain/data-schema";
import { formatCustomerCurrency } from "../customer-currency";

defineProps<{
  appointments: readonly DeepReadonly<AppointmentV1>[];
}>();

const expandedAppointmentId = shallowRef("");

function toggleDetail(appointmentId: string): void {
  expandedAppointmentId.value =
    expandedAppointmentId.value === appointmentId ? "" : appointmentId;
}

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
  <view class="customer-history">
    <view class="customer-history__heading">
      <text class="customer-history__title">历史预约</text>
      <text class="customer-history__count">{{ appointments.length }} 条</text>
    </view>
    <view v-if="!appointments.length" class="customer-history__empty" role="status">
      这位顾客还没有预约记录。
    </view>
    <template v-else>
      <view v-for="appointment in appointments" :key="appointment.id" class="history-card">
        <view class="history-card__heading">
          <view class="history-card__identity">
            <text class="history-card__projects">{{ appointment.projectSnapshots.map((project) => project.name).join("、") }}</text>
            <text class="history-card__status" :class="isOverdue(appointment) ? 'history-card__status--overdue' : `history-card__status--${appointment.status}`">
              {{ statusLabel(appointment) }}
            </text>
          </view>
          <text class="history-card__time">{{ formatSchedule(appointment.scheduledAt) }}</text>
        </view>
        <text class="history-card__summary">
          预计 {{ appointment.estimatedDurationMinutes }} 分钟 · 标准金额 {{ formatCustomerCurrency(appointment.standardAmountCents) }}
        </text>
        <text v-if="appointment.status === 'completed'" class="history-card__result">
          成交 {{ formatCustomerCurrency(appointment.transactionAmountCents) }} · 完成于 {{ formatSchedule(appointment.completedAt) }}
        </text>
        <text v-else-if="appointment.status === 'cancelled'" class="history-card__result">
          取消于 {{ formatSchedule(appointment.cancelledAt) }}{{ appointment.cancelReason ? ` · ${appointment.cancelReason}` : "" }}
        </text>
        <button class="history-card__toggle" @click="toggleDetail(appointment.id)">
          {{ expandedAppointmentId === appointment.id ? "收起详情" : "查看详情" }}
        </button>

        <view v-if="expandedAppointmentId === appointment.id" class="history-card__detail">
          <view class="history-card__section">
            <text class="history-card__section-title">项目明细</text>
            <text v-for="project in appointment.projectSnapshots" :key="project.projectId" class="history-card__line">
              {{ project.name }} · {{ project.durationMinutes }} 分钟 · {{ formatCustomerCurrency(project.standardPriceCents) }}
            </text>
          </view>
          <view class="history-card__section">
            <text class="history-card__section-title">服务地址</text>
            <text class="history-card__line">{{ appointment.serviceAddressSnapshot.addressText }}</text>
            <text v-if="appointment.serviceAddressSnapshot.note" class="history-card__line">{{ appointment.serviceAddressSnapshot.note }}</text>
          </view>
          <view v-if="appointment.actualUsages.length" class="history-card__section">
            <text class="history-card__section-title">本次用量</text>
            <text v-for="usage in appointment.actualUsages" :key="usage.inventoryItemId" class="history-card__line">
              {{ usage.itemNameSnapshot }} {{ usage.quantity }}{{ usage.unitSnapshot }}
            </text>
          </view>
          <view v-if="appointment.note" class="history-card__section">
            <text class="history-card__section-title">预约备注</text>
            <text class="history-card__line">{{ appointment.note }}</text>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped>
.customer-history { margin-top: 28rpx; }
.customer-history__heading, .history-card__heading, .history-card__identity { display: flex; align-items: center; }
.customer-history__heading { justify-content: space-between; gap: 16rpx; }
.customer-history__title { color: #263248; font-size: 28rpx; font-weight: 700; }
.customer-history__count { flex: none; color: #7a8597; font-size: 20rpx; }
.customer-history__empty { margin-top: 16rpx; padding: 30rpx 20rpx; border: 2rpx dashed #d5dbe4; border-radius: 14rpx; color: #7c8798; font-size: 22rpx; text-align: center; }
.history-card { margin-top: 16rpx; padding: 22rpx; border: 2rpx solid #e0e5ec; border-radius: 15rpx; background: #fff; }
.history-card__heading { align-items: flex-start; justify-content: space-between; gap: 14rpx; flex-wrap: wrap; }
.history-card__identity { min-width: 0; flex: 1; gap: 10rpx; flex-wrap: wrap; }
.history-card__projects { min-width: 0; flex: 1; color: #243047; font-size: 25rpx; font-weight: 700; overflow-wrap: anywhere; }
.history-card__status { flex: none; padding: 5rpx 10rpx; border-radius: 9rpx; font-size: 18rpx; }
.history-card__status--pending { background: #e8eefb; color: #31549e; }
.history-card__status--overdue { background: #fae9e7; color: #984943; }
.history-card__status--completed { background: #e5f2ea; color: #34704d; }
.history-card__status--cancelled { background: #eceef2; color: #737d8d; }
.history-card__time { flex: none; color: #31549e; font-size: 21rpx; font-weight: 600; }
.history-card__summary, .history-card__result { display: block; margin-top: 10rpx; color: #6f7b8f; font-size: 21rpx; line-height: 1.55; overflow-wrap: anywhere; }
.history-card__result { color: #4f607a; }
.history-card__toggle { min-height: 68rpx; margin-top: 16rpx; padding: 12rpx 22rpx; border: 2rpx solid #cad6ef; border-radius: 10rpx; background: #f4f7fc; color: #31549e; font-size: 21rpx; line-height: 1.35; }
.history-card__detail { margin-top: 16rpx; padding-top: 2rpx; border-top: 2rpx solid #edf0f4; }
.history-card__section { display: flex; margin-top: 15rpx; flex-direction: column; gap: 6rpx; }
.history-card__section-title { color: #42516b; font-size: 21rpx; font-weight: 700; }
.history-card__line { color: #6d788b; font-size: 20rpx; line-height: 1.55; overflow-wrap: anywhere; }
</style>
