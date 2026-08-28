<script setup lang="ts">
import { computed } from "vue";
import type { DeepReadonly } from "vue";
import type { CustomerV1 } from "@/domain/data-schema";
import type {
  AppointmentReminderGroup,
  BeautyHomeOverview,
} from "@/services/statistics-service";
import AppIcon from "@/features/shared/components/AppIcon.vue";
import RecoverableErrorNotice from "@/features/shared/components/RecoverableErrorNotice.vue";

const props = defineProps<{
  reminders: DeepReadonly<BeautyHomeOverview["reminders"]>;
  customers: readonly DeepReadonly<CustomerV1>[];
  loading: boolean;
  errorMessage: string;
}>();

const emit = defineEmits<{
  (event: "open-appointments"): void;
  (event: "retry"): void;
}>();

function customerName(customerId: string): string {
  return props.customers.find(({ id }) => id === customerId)?.nickname ?? "顾客已删除";
}

function formatSchedule(scheduledAt: string): string {
  const value = new Date(scheduledAt);
  return `${value.getMonth() + 1}月${value.getDate()}日 ${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

function reminderLabel(group: AppointmentReminderGroup): string {
  return group === "overdue" ? "已逾期" : group === "today" ? "今天" : "未来三天";
}

const reminderRows = computed(() =>
  props.reminders.map((reminder) => {
    const customer = customerName(reminder.appointment.customerId);
    const schedule = formatSchedule(reminder.appointment.scheduledAt);
    const projects = reminder.appointment.projectSnapshots
      .map(({ name }) => name)
      .join("、");
    return {
      id: reminder.appointment.id,
      group: reminder.group,
      badge: reminderLabel(reminder.group),
      customer,
      meta: `${schedule} · ${projects}`,
    };
  }),
);
</script>

<template>
  <section class="reminders" aria-labelledby="beauty-reminders-heading">
    <view class="reminders__heading">
      <text id="beauty-reminders-heading" class="reminders__title">近期预约</text>
      <button class="reminders__all" @click="emit('open-appointments')">
        <text>查看全部</text>
        <AppIcon name="chevron-right" :size="17" />
      </button>
    </view>

    <view class="reminders__panel">
      <view v-if="loading" class="reminders__empty" role="status">正在读取本机预约</view>
      <RecoverableErrorNotice
        v-else-if="errorMessage"
        :message="errorMessage"
        retryable
        @retry="emit('retry')"
      />
      <view v-else-if="reminderRows.length === 0" class="reminders__empty" role="status">
        暂无逾期、今天或未来三天的待执行预约
      </view>
      <view v-else class="reminders__list">
        <button
          v-for="row in reminderRows"
          :key="row.id"
          class="reminder-row"
          :aria-label="`${row.badge}，${row.customer}，${row.meta}`"
          @click="emit('open-appointments')"
        >
          <text
            class="reminder-row__badge"
            :class="`reminder-row__badge--${row.group}`"
          >
            {{ row.badge }}
          </text>
          <view class="reminder-row__copy">
            <text class="reminder-row__customer">{{ row.customer }}</text>
            <text class="reminder-row__meta">{{ row.meta }}</text>
          </view>
          <AppIcon class="reminder-row__arrow" name="chevron-right" :size="19" />
        </button>
      </view>
    </view>
  </section>
</template>

<style scoped>
.reminders {
  margin-top: 34rpx;
}

.reminders__heading {
  display: flex;
  min-height: 72rpx;
  align-items: center;
  justify-content: space-between;
  padding: 0 10rpx;
}

.reminders__title {
  color: #28232a;
  font-size: 31rpx;
  font-weight: 700;
}

.reminders__all {
  display: flex;
  min-height: 88rpx;
  align-items: center;
  gap: 4rpx;
  padding: 0 4rpx 0 18rpx;
  background: transparent;
  color: #92639d;
  font-size: 23rpx;
  line-height: 1;
}

.reminders__panel {
  padding: 20rpx;
  border: 2rpx solid rgba(143, 108, 132, 0.08);
  border-radius: 24rpx;
  background: #fffafb;
  box-shadow: 0 14rpx 38rpx rgba(119, 75, 103, 0.08);
}

.reminders__list {
  display: flex;
  gap: 16rpx;
  flex-direction: column;
}

.reminders__empty {
  padding: 34rpx 22rpx;
  border: 2rpx dashed #eadde4;
  border-radius: 18rpx;
  color: #81777f;
  font-size: 22rpx;
  line-height: 1.55;
  text-align: center;
}

.reminder-row {
  display: flex;
  width: 100%;
  min-height: 112rpx;
  align-items: center;
  gap: 18rpx;
  padding: 18rpx 18rpx 18rpx 20rpx;
  border: 2rpx solid #f1e9ed;
  border-radius: 20rpx;
  background: #ffffff;
  box-shadow: 0 9rpx 24rpx rgba(125, 91, 112, 0.06);
  text-align: left;
}

.reminder-row__badge {
  display: inline-flex;
  min-width: 92rpx;
  min-height: 64rpx;
  box-sizing: border-box;
  flex: none;
  align-items: center;
  justify-content: center;
  padding: 8rpx 12rpx;
  border-radius: 15rpx;
  background: #eee9f6;
  color: #7e61a0;
  font-size: 20rpx;
  line-height: 1.3;
  text-align: center;
}

.reminder-row__badge--overdue {
  background: #fae5e9;
  color: #bd4955;
}

.reminder-row__badge--today {
  background: #e7f2ec;
  color: #4d8a69;
}

.reminder-row__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.reminder-row__customer,
.reminder-row__meta {
  display: block;
  overflow-wrap: anywhere;
}

.reminder-row__customer {
  color: #28242a;
  font-size: 27rpx;
  font-weight: 650;
  line-height: 1.35;
}

.reminder-row__meta {
  margin-top: 8rpx;
  color: #817a81;
  font-size: 21rpx;
  line-height: 1.5;
}

.reminder-row__arrow {
  flex: none;
  color: #938d92;
}

@media (max-width: 360px) {
  .reminder-row {
    gap: 14rpx;
    padding-left: 16rpx;
  }

  .reminder-row__badge {
    min-width: 84rpx;
    font-size: 18rpx;
  }
}
</style>
