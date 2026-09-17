<script setup lang="ts">
import { computed } from "vue";
import type { DeepReadonly } from "vue";
import type { AppointmentV1, CustomerV1 } from "@/domain/data-schema";
import type {
  AppointmentMonthCalendar,
  AppointmentWeekCalendar,
} from "@/services/appointment-calendar-service";
import RecoverableErrorNotice from "@/features/shared/components/RecoverableErrorNotice.vue";

/** 美容模块“日程”页的月历展示契约，由模块组合页注入只读月历数据和导航动作。 */
interface AppointmentCalendarProps {
  /** 当前月份的预约月历，包含月首占位、日期和当天预约。 */
  calendar: DeepReadonly<AppointmentMonthCalendar>;
  /** 当前选中日期所在的连续七天，用于折叠周视图。 */
  weekCalendar: DeepReadonly<AppointmentWeekCalendar>;
  /** 月历展开或周历收起的当前形态。 */
  displayMode: "month" | "week";
  /** 当前选中的本地自然日键，格式 YYYY-MM-DD。 */
  selectedDateKey: string;
  /** 当前选中日期下按开始时间排序的预约。 */
  selectedAppointments: readonly DeepReadonly<AppointmentV1>[];
  /** 用于把预约顾客标识显示为昵称的本机顾客资料。 */
  customers: readonly DeepReadonly<CustomerV1>[];
  /** 是否正在读取本机预约数据。 */
  loading: boolean;
  /** 可恢复读取错误文案，空字符串表示当前无错误。 */
  errorMessage: string;
}

const props = defineProps<AppointmentCalendarProps>();

const weekLabels = ["日", "一", "二", "三", "四", "五", "六"];
const isSelectedToday = computed(() => props.selectedDateKey === localDateKey(new Date()));

const emit = defineEmits<{
  (event: "previous-period"): void;
  (event: "next-period"): void;
  (event: "go-today"): void;
  (event: "collapse-to-week"): void;
  (event: "expand-to-month"): void;
  (event: "select-date", dateKey: string): void;
  (event: "open-appointments"): void;
  (event: "retry"): void;
}>();
let touchStart: Touch | undefined;
const swipeThreshold = 48;

function customerName(customerId: string): string {
  return props.customers.find(({ id }) => id === customerId)?.nickname ?? "顾客资料不可用";
}

/** 按设备本地时区生成自然日键，避免 UTC 转换导致“今天”显示错误。 */
function localDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatSelectedDate(value: string): string {
  const [, month = "", day = ""] = value.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function formatTime(value: string): string {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function statusLabel(status: AppointmentV1["status"]): string {
  return status === "pending" ? "待执行" : status === "completed" ? "已完成" : "已取消";
}

function statusClass(status: AppointmentV1["status"]): string {
  return `calendar-appointment__status--${status}`;
}

/** 把日历区内明确的单指滑动转换为周期切换或周/月视图切换。 */
function startCalendarGesture(event: TouchEvent): void {
  touchStart = event.touches[0];
}

function endCalendarGesture(event: TouchEvent): void {
  const start = touchStart;
  const end = event.changedTouches[0];
  touchStart = undefined;
  if (!start || !end) return;

  const horizontalDistance = end.clientX - start.clientX;
  const verticalDistance = end.clientY - start.clientY;
  if (
    Math.max(Math.abs(horizontalDistance), Math.abs(verticalDistance)) < swipeThreshold ||
    Math.abs(horizontalDistance) === Math.abs(verticalDistance)
  ) {
    return;
  }
  if (Math.abs(horizontalDistance) > Math.abs(verticalDistance)) {
    if (horizontalDistance > 0) {
      emit("previous-period");
    } else {
      emit("next-period");
    }
    return;
  }
  if (verticalDistance < 0 && props.displayMode === "month") {
    emit("collapse-to-week");
  } else if (verticalDistance > 0 && props.displayMode === "week") {
    emit("expand-to-month");
  }
}
</script>

<template>
  <view class="calendar-panel">
    <view class="calendar-card" @touchstart="startCalendarGesture" @touchend="endCalendarGesture">
      <view class="calendar-card__toolbar">
        <view class="calendar-card__title-group">
          <text class="calendar-card__month-title">{{ calendar.year }}年{{ calendar.monthIndex + 1 }}月</text>
        </view>
        <view
          class="calendar-card__actions"
          :class="{ 'calendar-card__actions--hidden': isSelectedToday }"
          role="group"
          aria-label="日期操作"
          :aria-hidden="isSelectedToday"
        >
          <view class="calendar-card__today" role="button" :tabindex="isSelectedToday ? -1 : 0" hover-class="app-pressable" @click="$emit('go-today')" @keyup.enter="$emit('go-today')" @keyup.space.prevent="$emit('go-today')">回到今天</view>
        </view>
      </view>
      <view class="calendar-grid calendar-grid--week">
        <text v-for="label in weekLabels" :key="label">{{ label }}</text>
      </view>
      <view class="calendar-grid-stage" :class="`calendar-grid-stage--${displayMode}`">
        <view class="calendar-grid-stage__month">
          <view class="calendar-grid">
          <view v-for="blank in calendar.leadingBlankCount" :key="`blank-${blank}`" class="calendar-day calendar-day--blank" />
            <view
              v-for="day in calendar.days"
              :key="day.dateKey"
              class="calendar-day"
              :class="{ 'calendar-day--selected': day.dateKey === selectedDateKey }"
              role="button"
              tabindex="0"
              hover-class="app-pressable"
              @click="$emit('select-date', day.dateKey)"
              @keyup.enter="$emit('select-date', day.dateKey)"
              @keyup.space.prevent="$emit('select-date', day.dateKey)"
            >
              <text class="calendar-day__number">{{ day.dayOfMonth }}</text>
              <view v-if="day.appointments.length" class="calendar-day__markers" aria-hidden="true">
                <text
                  v-for="appointment in day.appointments.slice(0, 3)"
                  :key="appointment.id"
                  class="calendar-day__dot"
                  :class="`calendar-day__dot--${appointment.status}`"
                />
              </view>
            </view>
          </view>
        </view>
        <view class="calendar-grid-stage__week">
          <view class="calendar-grid">
            <view
              v-for="day in weekCalendar.days"
              :key="day.dateKey"
              class="calendar-day"
              :class="{ 'calendar-day--selected': day.dateKey === selectedDateKey }"
              role="button"
              tabindex="0"
              hover-class="app-pressable"
              @click="$emit('select-date', day.dateKey)"
              @keyup.enter="$emit('select-date', day.dateKey)"
              @keyup.space.prevent="$emit('select-date', day.dateKey)"
            >
              <text class="calendar-day__number">{{ day.dayOfMonth }}</text>
              <view v-if="day.appointments.length" class="calendar-day__markers" aria-hidden="true">
                <text
                  v-for="appointment in day.appointments.slice(0, 3)"
                  :key="appointment.id"
                  class="calendar-day__dot"
                  :class="`calendar-day__dot--${appointment.status}`"
                />
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
    <view class="calendar-panel__day-list">
      <view class="calendar-panel__day-heading">
        <view>
          <text class="calendar-panel__day-title">{{ formatSelectedDate(selectedDateKey) }}</text>
          <text class="calendar-panel__day-count">{{ selectedAppointments.length }}条预约</text>
        </view>
        <view class="calendar-panel__manage" role="button" tabindex="0" hover-class="app-pressable" @click="$emit('open-appointments')" @keyup.enter="$emit('open-appointments')" @keyup.space.prevent="$emit('open-appointments')">管理预约</view>
      </view>
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
      <view
        v-for="appointment in selectedAppointments"
        :key="appointment.id"
        class="calendar-appointment"
        role="button"
        tabindex="0"
        hover-class="app-pressable"
        @click="$emit('open-appointments')"
        @keyup.enter="$emit('open-appointments')"
        @keyup.space.prevent="$emit('open-appointments')"
      >
        <text class="calendar-appointment__time">{{ formatTime(appointment.scheduledAt) }}</text>
        <view class="calendar-appointment__divider" />
        <view class="calendar-appointment__copy">
          <text class="calendar-appointment__customer">{{ customerName(appointment.customerId) }}</text>
          <text class="calendar-appointment__projects">{{ appointment.projectSnapshots.map(({ name }) => name).join('、') }}</text>
        </view>
        <text class="calendar-appointment__status" :class="statusClass(appointment.status)">{{ statusLabel(appointment.status) }}</text>
        <u-icon name="arrow-right" color="#a29ba7" size="17" />
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import "../../../styles/_tokens.scss";

.calendar-panel {
  min-height: calc(100vh - 88rpx);
  box-sizing: border-box;
  padding: 32rpx 28rpx calc(164rpx + env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at 90% 88%, rgba(225, 181, 230, 0.36) 0, rgba(225, 181, 230, 0) 210rpx),
    $surface-page-rose;
}

.calendar-card,
.calendar-panel__day-list {
  border: 2rpx solid rgba(255, 255, 255, 0.72);
  border-radius: 26rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: $shadow-card;
}

.calendar-card {
  padding: 28rpx 28rpx 34rpx;
}

.calendar-card__toolbar,
.calendar-card__actions,
.calendar-card__title-group,
.calendar-panel__day-heading,
.calendar-panel__day-heading > view,
.calendar-appointment {
  display: flex;
  align-items: center;
}

.calendar-card__toolbar {
  min-height: 58rpx;
  justify-content: space-between;
  gap: 20rpx;
}

.calendar-card__title-group {
  min-width: 0;
  flex-direction: column;
  gap: 8rpx;
}

.calendar-card__month-title {
  min-width: 0;
  color: #2a2530;
  font-size: 37rpx;
  font-weight: 750;
  line-height: 1.2;
}

.calendar-card__actions {
  flex: none;
}

.calendar-card__actions--hidden {
  visibility: hidden;
  pointer-events: none;
}

.calendar-card__today,
.calendar-panel__manage {
  display: flex;
  align-items: center;
  justify-content: center;
}

.calendar-card__today {
  min-width: 148rpx;
  height: 58rpx;
  padding: 0 20rpx;
  border: 2rpx solid rgba(122, 85, 160, 0.18);
  border-radius: 31rpx;
  background: $surface-accent-subtle;
  color: #76508e;
  font-size: 22rpx;
  font-weight: 650;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 24rpx;
}

.calendar-grid-stage {
  display: grid;
  grid-template-rows: minmax(0, 1fr) minmax(0, 0fr);
  overflow: hidden;
  transition: grid-template-rows 340ms cubic-bezier(0.25, 1, 0.5, 1);
}

.calendar-grid-stage--week {
  grid-template-rows: minmax(0, 0fr) minmax(0, 1fr);
}

.calendar-grid-stage__month,
.calendar-grid-stage__week {
  min-height: 0;
  overflow: hidden;
}

.calendar-grid-stage__month .calendar-grid,
.calendar-grid-stage__week .calendar-grid {
  transition: opacity 220ms cubic-bezier(0.25, 1, 0.5, 1), transform 340ms cubic-bezier(0.25, 1, 0.5, 1);
}

.calendar-grid-stage--week .calendar-grid-stage__month .calendar-grid {
  opacity: 0;
  transform: translateY(-20rpx);
}

.calendar-grid-stage--month .calendar-grid-stage__week .calendar-grid {
  opacity: 0;
  transform: translateY(20rpx);
}

.calendar-grid-stage--week .calendar-grid-stage__week .calendar-grid {
  margin-top: 18rpx;
}

@media (prefers-reduced-motion: reduce) {
  .calendar-grid-stage,
  .calendar-grid-stage__month .calendar-grid,
  .calendar-grid-stage__week .calendar-grid {
    transition-duration: 0.01ms;
  }
}

.calendar-grid--week {
  margin-top: 36rpx;
  color: #7f7984;
  font-size: 23rpx;
  font-weight: 500;
  text-align: center;
}

.calendar-day {
  position: relative;
  display: flex;
  width: 74rpx;
  height: 74rpx;
  align-items: center;
  justify-content: center;
  justify-self: center;
  border-radius: 50%;
  color: #24202a;
  font-size: 25rpx;
  font-weight: 500;
}

.calendar-day--blank {
  color: #aaa4ad;
}

.calendar-day--selected {
  background: linear-gradient(135deg, #8c56bc 0%, #6f43a8 100%);
  box-shadow: 0 10rpx 22rpx rgba(119, 71, 168, 0.24);
  color: #fff;
  font-size: 31rpx;
  font-weight: 750;
}

.calendar-day__number {
  line-height: 1;
}

.calendar-day__markers {
  position: absolute;
  right: 0;
  bottom: 8rpx;
  left: 0;
  display: flex;
  justify-content: center;
  gap: 4rpx;
}

.calendar-day__dot {
  width: 9rpx;
  height: 9rpx;
  border-radius: 50%;
}

.calendar-day__dot--pending {
  background: #8b57b7;
}

.calendar-day__dot--completed {
  background: #48aa78;
}

.calendar-day__dot--cancelled {
  background: #ee83ad;
}

.calendar-day--selected .calendar-day__dot {
  width: 10rpx;
  height: 10rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.72);
}

.calendar-panel__day-list {
  margin-top: 28rpx;
  padding: 26rpx 22rpx 24rpx;
}

.calendar-panel__day-heading {
  justify-content: space-between;
  gap: 18rpx;
}

.calendar-panel__day-heading > view {
  min-width: 0;
  gap: 28rpx;
}

.calendar-panel__day-title {
  color: $text-strong;
  font-size: 37rpx;
  font-weight: 750;
  line-height: 1.2;
}

.calendar-panel__day-count {
  color: #8055a9;
  font-size: 28rpx;
  font-weight: 650;
}

.calendar-panel__manage {
  flex: none;
  min-width: 142rpx;
  height: 58rpx;
  padding: 0 22rpx;
  border-radius: 30rpx;
  background: $surface-accent-soft;
  color: #7a55a0;
  font-size: 23rpx;
  font-weight: 650;
}

.calendar-panel__empty {
  margin-top: 18rpx;
  padding: 28rpx 24rpx;
  border: 2rpx dashed rgba(139, 112, 128, 0.2);
  border-radius: 20rpx;
  color: $text-subtle;
  font-size: 23rpx;
  line-height: 1.5;
  text-align: center;
}

.calendar-appointment {
  min-height: 92rpx;
  gap: 20rpx;
  margin-top: 16rpx;
  padding: 18rpx 20rpx;
  border: 2rpx solid rgba(139, 112, 128, 0.08);
  border-radius: 18rpx;
  background: $surface-card;
  box-shadow: 0 10rpx 26rpx rgba(139, 84, 109, 0.06);
}

.calendar-appointment__time {
  flex: none;
  width: 108rpx;
  color: #7b43ad;
  font-size: 30rpx;
  font-weight: 750;
  line-height: 1.2;
}

.calendar-appointment__divider {
  flex: none;
  width: 2rpx;
  height: 44rpx;
  background: rgba(139, 112, 128, 0.18);
}

.calendar-appointment__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.calendar-appointment__customer,
.calendar-appointment__projects {
  overflow-wrap: anywhere;
}

.calendar-appointment__customer {
  color: $text-strong;
  font-size: 27rpx;
  font-weight: 700;
  line-height: 1.25;
}

.calendar-appointment__projects {
  margin-top: 6rpx;
  color: $text-muted;
  font-size: 22rpx;
  line-height: 1.4;
}

.calendar-appointment__status {
  flex: none;
  padding: 10rpx 16rpx;
  border-radius: 12rpx;
  font-size: 22rpx;
  font-weight: 650;
  line-height: 1;
}

.calendar-appointment__status--pending {
  background: #e9f7ef;
  color: $success;
}

.calendar-appointment__status--completed {
  background: $surface-accent-soft;
  color: #7a55a0;
}

.calendar-appointment__status--cancelled {
  background: #fde9ef;
  color: #bd526e;
}
</style>
