import type {
  AppointmentV1,
  CompletedAppointmentV1,
  PendingAppointmentV1,
} from "@/domain/data-schema";

/** 首页提醒的派生分组；不写回预约状态。 */
export type AppointmentReminderGroup = "overdue" | "today" | "next-three-days";

export interface AppointmentReminder {
  /** 原待执行预约，供页面继续展示顾客、项目和地址信息。 */
  appointment: PendingAppointmentV1;
  /** 逾期、今天或未来三天，按此顺序展示。 */
  group: AppointmentReminderGroup;
}

export interface BeautyHomeOverview {
  /** 当前本地自然月内、按实际完成时间归属的完成次数。 */
  monthlyCompletedCount: number;
  /** 当前本地自然月内的成交金额合计，单位为分。 */
  monthlyTransactionAmountCents: number;
  /** 所有待执行预约数量，包含逾期和更远预约。 */
  pendingCount: number;
  /** 全部逾期、今天剩余及未来三个本地自然日的预约。 */
  reminders: AppointmentReminder[];
}

export interface CustomerBusinessSummary {
  /** 未删除的已完成预约次数。 */
  completedCount: number;
  /** 未删除的已完成预约成交金额合计，单位为分。 */
  transactionAmountCents: number;
}

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addLocalDays(value: Date, days: number): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + days);
}

function sumCompletedAmounts(
  appointments: readonly CompletedAppointmentV1[],
): number {
  let total = 0;
  for (const appointment of appointments) {
    total += appointment.transactionAmountCents;
    if (!Number.isSafeInteger(total)) {
      throw new Error("成交金额汇总超出可安全计算范围");
    }
  }
  return total;
}

/**
 * 从预约源记录派生美容首页数据。边界使用设备本地自然日和自然月，
 * “未来三天”指明天起连续三个自然日，不包含今天。
 */
export function deriveBeautyHomeOverview(
  appointments: readonly AppointmentV1[],
  now: Date = new Date(),
): BeautyHomeOverview {
  const nowTime = now.getTime();
  if (!Number.isFinite(nowTime)) {
    throw new Error("统计时间无效");
  }
  const todayStart = startOfLocalDay(now).getTime();
  const tomorrowStart = addLocalDays(now, 1).getTime();
  const afterNextThreeDays = addLocalDays(now, 4).getTime();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const pending = appointments.filter(
    (appointment): appointment is PendingAppointmentV1 =>
      appointment.status === "pending",
  );
  const completedThisMonth = appointments.filter(
    (appointment): appointment is CompletedAppointmentV1 => {
      if (appointment.status !== "completed") {
        return false;
      }
      const completedAt = new Date(appointment.completedAt).getTime();
      return completedAt >= monthStart && completedAt < nextMonthStart;
    },
  );
  const reminders = pending
    .map((appointment): AppointmentReminder | undefined => {
      const scheduledAt = new Date(appointment.scheduledAt).getTime();
      if (scheduledAt < nowTime) {
        return { appointment, group: "overdue" };
      }
      if (scheduledAt >= todayStart && scheduledAt < tomorrowStart) {
        return { appointment, group: "today" };
      }
      if (scheduledAt >= tomorrowStart && scheduledAt < afterNextThreeDays) {
        return { appointment, group: "next-three-days" };
      }
      return undefined;
    })
    .filter((reminder): reminder is AppointmentReminder => reminder !== undefined)
    .sort((left, right) => {
      const order: Record<AppointmentReminderGroup, number> = {
        overdue: 0,
        today: 1,
        "next-three-days": 2,
      };
      return (
        order[left.group] - order[right.group] ||
        left.appointment.scheduledAt.localeCompare(right.appointment.scheduledAt)
      );
    });
  return {
    monthlyCompletedCount: completedThisMonth.length,
    monthlyTransactionAmountCents: sumCompletedAmounts(completedThisMonth),
    pendingCount: pending.length,
    reminders,
  };
}

/** 从未删除的已完成预约派生单个顾客累计经营数据。 */
export function deriveCustomerBusinessSummary(
  customerId: string,
  appointments: readonly AppointmentV1[],
): CustomerBusinessSummary {
  const completed = appointments.filter(
    (appointment): appointment is CompletedAppointmentV1 =>
      appointment.status === "completed" && appointment.customerId === customerId,
  );
  return {
    completedCount: completed.length,
    transactionAmountCents: sumCompletedAmounts(completed),
  };
}
