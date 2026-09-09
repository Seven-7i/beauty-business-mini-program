<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type {
  AppointmentV1,
  CustomerV1,
  PendingAppointmentV1,
} from "@/domain/data-schema";

defineProps<{
  appointments: readonly DeepReadonly<AppointmentV1>[];
  customers: readonly DeepReadonly<CustomerV1>[];
  disabled: boolean;
}>();

const emit = defineEmits<{
  (event: "open-detail", appointment: DeepReadonly<AppointmentV1>): void;
  (event: "complete", appointment: DeepReadonly<PendingAppointmentV1>): void;
}>();

/** 返回预约顾客昵称，资料缺失时提供可诊断占位。 */
function customerName(
  customerId: string,
  customers: readonly DeepReadonly<CustomerV1>[],
): string {
  return (
    customers.find((customer) => customer.id === customerId)?.nickname ??
    "顾客资料不可用"
  );
}

/** 格式化预约卡片使用的本地时间。 */
function formatSchedule(value: string): string {
  const date = new Date(value);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return sameDay
    ? `今天 ${time}`
    : `${date.getMonth() + 1}月${date.getDate()}日 ${time}`;
}

/** 待执行且开始时间早于当前时刻时展示逾期提醒。 */
function isOverdue(appointment: DeepReadonly<AppointmentV1>): boolean {
  return (
    appointment.status === "pending" &&
    new Date(appointment.scheduledAt).getTime() < Date.now()
  );
}

/** 生成卡片左侧的短状态标签。 */
function cardLabel(appointment: DeepReadonly<AppointmentV1>): string {
  if (isOverdue(appointment)) {
    return "已逾期";
  }
  if (appointment.recordOrigin === "backfilled") {
    return appointment.status === "completed"
      ? "后补"
      : "后补 · 未完成";
  }
  if (appointment.status === "pending") {
    const days = Math.ceil(
      (new Date(appointment.scheduledAt).getTime() - Date.now()) / 86_400_000,
    );
    return days <= 1 ? "今天" : `未来${days}天`;
  }
  return appointment.status === "completed" ? "已完成" : "已取消";
}
</script>

<template>
  <view class="appointment-list">
    <view v-if="!appointments.length" class="appointment-list__empty" role="status">
      <u-icon name="calendar" color="#9a92a4" size="32" />
      <text>当前条件下没有预约记录</text>
    </view>
    <view
      v-for="appointment in appointments"
      :key="appointment.id"
      class="appointment-card"
      role="button"
      tabindex="0"
      @click="emit('open-detail', appointment)"
    >
      <view class="appointment-card__top">
        <text
          v-if="appointment.status !== 'completed' || appointment.recordOrigin === 'backfilled'"
          class="appointment-card__badge"
          :class="{
            'appointment-card__badge--danger': isOverdue(appointment),
            'appointment-card__badge--backfilled': appointment.recordOrigin === 'backfilled',
            'appointment-card__badge--cancelled': appointment.status === 'cancelled',
          }"
        >
          {{ cardLabel(appointment) }}
        </text>
        <view class="appointment-card__identity">
          <text class="appointment-card__customer">
            {{ customerName(appointment.customerId, customers) }}
          </text>
          <text class="appointment-card__time">{{ formatSchedule(appointment.scheduledAt) }}</text>
        </view>
        <u-icon name="arrow-right" color="#6d6875" size="20" />
      </view>
      <text class="appointment-card__projects">
        {{ appointment.projectSnapshots.map((project) => project.name).join("、") }}
      </text>
      <text class="appointment-card__meta">
        预计 {{ appointment.estimatedDurationMinutes }} 分钟 · 标准金额 ¥{{ (appointment.standardAmountCents / 100).toFixed(2) }}
      </text>
      <text v-if="appointment.status === 'completed'" class="appointment-card__result">
        成交 ¥{{ (appointment.transactionAmountCents / 100).toFixed(2) }}
      </text>
      <text v-if="appointment.status === 'cancelled'" class="appointment-card__result appointment-card__result--cancelled">
        {{ appointment.cancelReason || "历史记录未填写取消原因" }}
      </text>
      <view class="appointment-card__bottom">
        <view class="appointment-card__address">
          <u-icon name="map" color="#6b6673" size="19" />
          <text>{{ appointment.serviceAddressSnapshot.addressText }}</text>
        </view>
        <button
          v-if="appointment.status === 'pending'"
          class="appointment-card__complete"
          :disabled="disabled"
          @click.stop="emit('complete', appointment)"
        >
          完成预约
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.appointment-list { padding-bottom: 40rpx; }
.appointment-list__empty { display: flex; margin-top: 20rpx; padding: 80rpx 20rpx; align-items: center; gap: 16rpx; border: 2rpx dashed #ddd8e2; border-radius: 20rpx; color: #8a8390; font-size: 24rpx; flex-direction: column; }
.appointment-card { margin-top: 20rpx; padding: 26rpx; border: 2rpx solid #f0edf3; border-radius: 22rpx; background: rgba(255, 255, 255, 0.97); box-shadow: 0 10rpx 28rpx rgba(43, 30, 59, 0.055); }
.appointment-card__top, .appointment-card__bottom, .appointment-card__address { display: flex; align-items: center; }
.appointment-card__top { gap: 20rpx; flex-wrap: wrap; }
.appointment-card__badge { flex: none; padding: 13rpx 16rpx; border-radius: 11rpx; background: #e7f4ee; color: #159562; font-size: 22rpx; }
.appointment-card__badge--danger { background: #ffe8e9; color: #f22534; }
.appointment-card__badge--backfilled { background: #efeaff; color: #5136df; }
.appointment-card__badge--cancelled { background: #f0eef2; color: #77717d; }
.appointment-card__identity { display: flex; min-width: 0; flex: 1; flex-direction: column; }
.appointment-card__customer { color: #16131b; font-size: 31rpx; font-weight: 700; }
.appointment-card__time { margin-top: 4rpx; color: #66606d; font-size: 22rpx; }
.appointment-card__projects { display: block; margin-top: 24rpx; color: #211d25; font-size: 29rpx; font-weight: 550; overflow-wrap: anywhere; }
.appointment-card__meta, .appointment-card__result { display: block; margin-top: 10rpx; color: #77717e; font-size: 22rpx; }
.appointment-card__result { color: #2f7a54; }
.appointment-card__result--cancelled { color: #9a5961; }
.appointment-card__bottom { justify-content: space-between; gap: 18rpx; margin-top: 24rpx; }
.appointment-card__address { min-width: 0; gap: 9rpx; flex: 1; color: #625d69; font-size: 22rpx; }
.appointment-card__address text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.appointment-card__complete { width: 166rpx; min-height: 68rpx; height: 70rpx; flex: none; border-radius: 12rpx; background: linear-gradient(135deg, #6041df, #4527d5); color: #fff; font-size: 23rpx; line-height: 70rpx; }
</style>
