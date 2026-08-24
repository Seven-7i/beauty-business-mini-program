<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type {
  AppointmentV1,
  CancelledAppointmentV1,
  CompletedAppointmentV1,
  CustomerV1,
  PendingAppointmentV1,
} from "@/domain/data-schema";

defineProps<{
  appointments: readonly AppointmentV1[];
  customers: readonly DeepReadonly<CustomerV1>[];
  disabled: boolean;
}>();

const emit = defineEmits<{
  (event: "complete", appointment: DeepReadonly<PendingAppointmentV1>): void;
  (event: "edit", appointment: DeepReadonly<PendingAppointmentV1>): void;
  (event: "cancel", appointment: DeepReadonly<PendingAppointmentV1>): void;
  (event: "restore-cancelled", appointment: DeepReadonly<CancelledAppointmentV1>): void;
  (event: "revert-completed", appointment: DeepReadonly<CompletedAppointmentV1>): void;
  (event: "correct-completed", appointment: DeepReadonly<CompletedAppointmentV1>): void;
  (event: "delete", appointment: DeepReadonly<AppointmentV1>): void;
}>();

function customerName(
  customerId: string,
  customers: readonly DeepReadonly<CustomerV1>[],
): string {
  return customers.find((customer) => customer.id === customerId)?.nickname ?? "顾客资料不可用";
}

function formatSchedule(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** 逾期是当前时间派生的展示标签，绝不写回为第四种预约状态。 */
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
  <view class="appointment-list">
    <view class="appointment-list__heading"><text>预约记录</text><text>{{ appointments.length }} 条</text></view>
    <view v-if="!appointments.length" class="appointment-list__empty">还没有预约记录。</view>
    <view v-for="appointment in appointments" :key="appointment.id" class="appointment-card">
      <view class="appointment-card__heading">
        <view class="appointment-card__identity">
          <text class="appointment-card__customer">{{ customerName(appointment.customerId, customers) }}</text>
          <text class="appointment-card__status" :class="isOverdue(appointment) ? 'appointment-card__status--overdue' : `appointment-card__status--${appointment.status}`">{{ statusLabel(appointment) }}</text>
        </view>
        <text class="appointment-card__time">{{ formatSchedule(appointment.scheduledAt) }}</text>
      </view>
      <text class="appointment-card__projects">{{ appointment.projectSnapshots.map((project) => project.name).join("、") }}</text>
      <text class="appointment-card__meta">预计 {{ appointment.estimatedDurationMinutes }} 分钟 · 标准金额 ¥{{ (appointment.standardAmountCents / 100).toFixed(2) }}</text>
      <text v-if="appointment.status === 'completed'" class="appointment-card__result">成交 ¥{{ (appointment.transactionAmountCents / 100).toFixed(2) }} · 完成于 {{ formatSchedule(appointment.completedAt) }}</text>
      <text v-if="appointment.status === 'cancelled'" class="appointment-card__result">取消于 {{ formatSchedule(appointment.cancelledAt) }}{{ appointment.cancelReason ? ` · ${appointment.cancelReason}` : "" }}</text>
      <text class="appointment-card__address">{{ appointment.serviceAddressSnapshot.addressText }}</text>
      <view v-if="appointment.status === 'pending'" class="appointment-card__actions">
        <button :disabled="disabled" @click="emit('edit', appointment)">编辑</button>
        <button :disabled="disabled" @click="emit('complete', appointment)">完成</button>
        <button class="appointment-card__cancel" :disabled="disabled" @click="emit('cancel', appointment)">取消预约</button>
        <button class="appointment-card__delete" :disabled="disabled" @click="emit('delete', appointment)">彻底删除</button>
      </view>
      <view v-else-if="appointment.status === 'cancelled'" class="appointment-card__actions">
        <button :disabled="disabled" @click="emit('restore-cancelled', appointment)">恢复取消</button>
        <button class="appointment-card__delete" :disabled="disabled" @click="emit('delete', appointment)">彻底删除</button>
      </view>
      <view v-else class="appointment-card__actions">
        <button :disabled="disabled" @click="emit('correct-completed', appointment)">更正</button>
        <button :disabled="disabled" @click="emit('revert-completed', appointment)">撤销完成</button>
        <button class="appointment-card__delete" :disabled="disabled" @click="emit('delete', appointment)">彻底删除</button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.appointment-list { margin-top: 28rpx; }
.appointment-list__heading, .appointment-card__heading, .appointment-card__identity, .appointment-card__actions { display: flex; align-items: center; }
.appointment-list__heading, .appointment-card__heading { justify-content: space-between; }
.appointment-list__heading { color: #263248; font-size: 27rpx; font-weight: 700; }
.appointment-list__heading text:last-child { color: #7a8597; font-size: 20rpx; font-weight: 400; }
.appointment-list__empty { margin-top: 16rpx; padding: 30rpx; border: 2rpx dashed #d5dbe4; border-radius: 14rpx; color: #7c8798; font-size: 22rpx; text-align: center; }
.appointment-card { display: flex; margin-top: 16rpx; padding: 24rpx; border: 2rpx solid #e0e5ec; border-radius: 17rpx; background: #fff; flex-direction: column; }
.appointment-card__heading { gap: 16rpx; }
.appointment-card__identity { min-width: 0; gap: 10rpx; }
.appointment-card__customer { color: #243047; font-size: 27rpx; font-weight: 700; }
.appointment-card__status { flex: none; padding: 5rpx 10rpx; border-radius: 9rpx; font-size: 18rpx; }
.appointment-card__status--pending { background: #e8eefb; color: #31549e; }
.appointment-card__status--overdue { background: #fae9e7; color: #984943; }
.appointment-card__status--completed { background: #e5f2ea; color: #34704d; }
.appointment-card__status--cancelled { background: #eceef2; color: #737d8d; }
.appointment-card__time { flex: none; color: #31549e; font-size: 22rpx; font-weight: 600; }
.appointment-card__projects { margin-top: 14rpx; color: #46536a; font-size: 23rpx; }
.appointment-card__meta, .appointment-card__address, .appointment-card__result { margin-top: 8rpx; color: #788397; font-size: 21rpx; line-height: 1.5; }
.appointment-card__result { color: #4f607a; }
.appointment-card__actions { justify-content: flex-end; gap: 10rpx; margin-top: 18rpx; flex-wrap: wrap; }
.appointment-card__actions button { height: 68rpx; padding: 0 24rpx; border-radius: 11rpx; background: #e8eefb; color: #31549e; font-size: 21rpx; line-height: 68rpx; }
.appointment-card__actions .appointment-card__cancel { background: #fff0ef; color: #9a4a47; }
.appointment-card__actions .appointment-card__delete { border: 2rpx solid #e5c8c5; background: #fff; color: #9a4a47; }
</style>
