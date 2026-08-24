import type { AppointmentV1 } from "@/domain/data-schema";

export interface AppointmentCalendarDay {
  /** 本地自然日键，格式 YYYY-MM-DD。 */
  dateKey: string;
  /** 当月日号。 */
  dayOfMonth: number;
  /** 该计划日期下的全部预约，按开始时间排序。 */
  appointments: AppointmentV1[];
}

export interface AppointmentMonthCalendar {
  year: number;
  /** JavaScript 月序号，0 表示一月。 */
  monthIndex: number;
  /** 当月 1 日前的星期占位数，周日为 0。 */
  leadingBlankCount: number;
  days: AppointmentCalendarDay[];
}

function localDateKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

/**
 * 生成预约月历。所有状态都按原计划开始时间出现在月历中；状态筛选属于列表展示，
 * 月历本身不丢失已完成或已取消的历史事实。
 */
export function buildAppointmentMonthCalendar(
  year: number,
  monthIndex: number,
  appointments: readonly AppointmentV1[],
): AppointmentMonthCalendar {
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    throw new Error("月历年月无效");
  }
  const firstDay = new Date(year, monthIndex, 1);
  const dayCount = new Date(year, monthIndex + 1, 0).getDate();
  const grouped = new Map<string, AppointmentV1[]>();
  for (const appointment of appointments) {
    const scheduledAt = new Date(appointment.scheduledAt);
    if (
      scheduledAt.getFullYear() !== year ||
      scheduledAt.getMonth() !== monthIndex
    ) {
      continue;
    }
    const dateKey = localDateKey(scheduledAt);
    const dayAppointments = grouped.get(dateKey) ?? [];
    dayAppointments.push(appointment);
    grouped.set(dateKey, dayAppointments);
  }
  return {
    year,
    monthIndex,
    leadingBlankCount: firstDay.getDay(),
    days: Array.from({ length: dayCount }, (_, index) => {
      const date = new Date(year, monthIndex, index + 1);
      const dateKey = localDateKey(date);
      return {
        dateKey,
        dayOfMonth: index + 1,
        appointments: [...(grouped.get(dateKey) ?? [])].sort((left, right) =>
          left.scheduledAt.localeCompare(right.scheduledAt),
        ),
      };
    }),
  };
}
