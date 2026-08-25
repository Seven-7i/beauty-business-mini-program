<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { AppointmentV1, CustomerV1 } from "@/domain/data-schema";
import type { AppointmentMonthCalendar } from "@/services/appointment-calendar-service";
import RecoverableErrorNotice from "@/features/shared/components/RecoverableErrorNotice.vue";

const props = defineProps<{
  calendar: DeepReadonly<AppointmentMonthCalendar>;
  selectedDateKey: string;
  selectedAppointments: readonly DeepReadonly<AppointmentV1>[];
  customers: readonly DeepReadonly<CustomerV1>[];
  loading: boolean;
  errorMessage: string;
}>();

defineEmits<{
  (event: "previous-month"): void;
  (event: "next-month"): void;
  (event: "select-date", dateKey: string): void;
  (event: "open-appointments"): void;
  (event: "retry"): void;
}>();

const weekLabels = ["日", "一", "二", "三", "四", "五", "六"];

function customerName(customerId: string): string {
  return props.customers.find(({ id }) => id === customerId)?.nickname ?? "顾客资料不可用";
}

function formatTime(value: string): string {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function statusLabel(status: AppointmentV1["status"]): string {
  return status === "pending" ? "待执行" : status === "completed" ? "已完成" : "已取消";
}
</script>

<template>
  <view class="calendar-panel">
    <view class="calendar-panel__heading">
      <view><text class="calendar-panel__eyebrow">预约视图</text><text class="calendar-panel__title">日程</text></view>
      <button @click="$emit('open-appointments')">管理预约</button>
    </view>
    <view class="calendar-panel__month">
      <button @click="$emit('previous-month')">‹</button>
      <text>{{ calendar.year }} 年 {{ calendar.monthIndex + 1 }} 月</text>
      <button @click="$emit('next-month')">›</button>
    </view>
    <view class="calendar-grid calendar-grid--week"><text v-for="label in weekLabels" :key="label">{{ label }}</text></view>
    <view class="calendar-grid">
      <view v-for="blank in calendar.leadingBlankCount" :key="`blank-${blank}`" class="calendar-day calendar-day--blank" />
      <button v-for="day in calendar.days" :key="day.dateKey" class="calendar-day" :class="{ 'calendar-day--selected': day.dateKey === selectedDateKey }" @click="$emit('select-date', day.dateKey)">
        <text>{{ day.dayOfMonth }}</text>
        <text v-if="day.appointments.length" class="calendar-day__count">{{ day.appointments.length }}</text>
      </button>
    </view>
    <view class="calendar-panel__day-list">
      <text class="calendar-panel__day-title">{{ selectedDateKey }} · {{ selectedAppointments.length }} 条</text>
      <view v-if="loading" class="calendar-panel__empty">正在读取本机预约</view>
      <RecoverableErrorNotice
        v-else-if="errorMessage"
        :message="errorMessage"
        retryable
        @retry="$emit('retry')"
      />
      <view v-else-if="!selectedAppointments.length" class="calendar-panel__empty" role="status">
        当天没有预约，可前往“管理预约”新增或调整日期。
      </view>
      <button v-for="appointment in selectedAppointments" :key="appointment.id" class="calendar-appointment" @click="$emit('open-appointments')">
        <text class="calendar-appointment__time">{{ formatTime(appointment.scheduledAt) }}</text>
        <view class="calendar-appointment__copy"><text>{{ customerName(appointment.customerId) }}</text><text>{{ appointment.projectSnapshots.map(({ name }) => name).join('、') }}</text></view>
        <text class="calendar-appointment__status">{{ statusLabel(appointment.status) }}</text>
      </button>
    </view>
  </view>
</template>

<style scoped>
.calendar-panel { min-height: calc(100vh - 88rpx); box-sizing: border-box; padding: 44rpx 28rpx calc(150rpx + env(safe-area-inset-bottom)); }
.calendar-panel__heading, .calendar-panel__month, .calendar-appointment { display: flex; align-items: center; }
.calendar-panel__heading { justify-content: space-between; gap: 16rpx; flex-wrap: wrap; }
.calendar-panel__heading > view { display: flex; flex-direction: column; }
.calendar-panel__eyebrow { color: #31549e; font-size: 22rpx; font-weight: 600; }
.calendar-panel__title { margin-top: 10rpx; color: #1a2538; font-size: 42rpx; font-weight: 700; }
.calendar-panel__heading button { min-height: 68rpx; padding: 0 20rpx; background: #e8eefb; color: #31549e; font-size: 21rpx; }
.calendar-panel__month { justify-content: space-between; margin-top: 30rpx; color: #29364d; font-size: 27rpx; font-weight: 700; }
.calendar-panel__month button { width: 68rpx; height: 68rpx; background: transparent; color: #31549e; font-size: 42rpx; line-height: 68rpx; }
.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8rpx; margin-top: 10rpx; }
.calendar-grid--week { color: #7c8695; font-size: 19rpx; text-align: center; }
.calendar-day { position: relative; height: 70rpx; padding: 0; border-radius: 11rpx; background: #fff; color: #39465b; font-size: 22rpx; line-height: 70rpx; }
.calendar-day--blank { background: transparent; }
.calendar-day--selected { background: #31549e; color: #fff; }
.calendar-day__count { position: absolute; top: 4rpx; right: 6rpx; min-width: 23rpx; height: 23rpx; border-radius: 12rpx; background: #dbe5fb; color: #31549e; font-size: 15rpx; line-height: 23rpx; }
.calendar-panel__day-list { margin-top: 28rpx; }
.calendar-panel__day-title { color: #344158; font-size: 23rpx; font-weight: 700; }
.calendar-panel__empty { margin-top: 14rpx; padding: 26rpx; border: 2rpx dashed #d5dbe4; border-radius: 14rpx; color: #7c8798; font-size: 21rpx; text-align: center; }
.calendar-appointment { width: 100%; min-height: 90rpx; align-items: flex-start; gap: 16rpx; margin-top: 12rpx; padding: 16rpx 18rpx; border: 2rpx solid #e0e5ec; border-radius: 14rpx; background: #fff; text-align: left; flex-wrap: wrap; }
.calendar-appointment__time { flex: none; color: #31549e; font-size: 23rpx; font-weight: 700; }
.calendar-appointment__copy { display: flex; min-width: 0; flex: 1; flex-direction: column; color: #2b374d; font-size: 22rpx; }
.calendar-appointment__copy text { overflow-wrap: anywhere; }
.calendar-appointment__copy text:last-child { margin-top: 5rpx; color: #7b8595; font-size: 18rpx; line-height: 1.45; }
.calendar-appointment__status { flex: none; color: #68758a; font-size: 18rpx; }
</style>
