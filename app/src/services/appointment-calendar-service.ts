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

/** 连续七天的周视图数据；允许跨越月末和年末。 */
export interface AppointmentWeekCalendar {
  /** 周日对应的本地自然日键。 */
  startDateKey: string;
  /** 周六对应的本地自然日键。 */
  endDateKey: string;
  /** 从周日到周六排列的七天。 */
  days: AppointmentCalendarDay[];
}

function localDateKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function localDateFromKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function appointmentsByDate(appointments: readonly AppointmentV1[]): Map<string, AppointmentV1[]> {
  const grouped = new Map<string, AppointmentV1[]>();
  for (const appointment of appointments) {
    const scheduledAt = new Date(appointment.scheduledAt);
    const key = localDateKey(scheduledAt);
    const sameDateAppointments = grouped.get(key) ?? [];
    sameDateAppointments.push(appointment);
    grouped.set(key, sameDateAppointments);
  }
  return grouped;
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
  const grouped = appointmentsByDate(appointments);
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

/**
 * 根据选中日期生成所在自然周。周视图仍保留所有预约状态，避免跨月时丢失历史预约。
 */
export function buildAppointmentWeekCalendar(
  selectedDateKey: string,
  appointments: readonly AppointmentV1[],
): AppointmentWeekCalendar {
  const selectedDate = localDateFromKey(selectedDateKey);
  const startDate = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate() - selectedDate.getDay(),
  );
  const grouped = appointmentsByDate(appointments);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + index);
    const dateKey = localDateKey(date);
    return {
      dateKey,
      dayOfMonth: date.getDate(),
      appointments: [...(grouped.get(dateKey) ?? [])].sort((left, right) =>
        left.scheduledAt.localeCompare(right.scheduledAt),
      ),
    };
  });
  return {
    startDateKey: days[0].dateKey,
    endDateKey: days[6].dateKey,
    days,
  };
}
