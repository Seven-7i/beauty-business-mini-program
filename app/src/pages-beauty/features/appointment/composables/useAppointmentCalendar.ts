import { computed, readonly, shallowRef } from "vue";
import type { AppointmentV1, CustomerV1 } from "@/domain/data-schema";
import type { ApplicationDataRepository } from "@/repositories/application-data-repository";
import {
  buildAppointmentMonthCalendar,
  buildAppointmentWeekCalendar,
} from "@/services/appointment-calendar-service";

type AppointmentCalendarRepository = Pick<ApplicationDataRepository, "readSnapshot">;
type AppointmentCalendarDisplayMode = "month" | "week";

function dateKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function dateFromKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** 编排月历月份切换、日期选择和本机预约读取，当前用于美容模块“日程”页。 */
export function useAppointmentCalendar(
  repository: AppointmentCalendarRepository,
  today: () => Date = () => new Date(),
) {
  const initialDate = today();
  const monthCursor = shallowRef(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const selectedDateKey = shallowRef(dateKey(initialDate));
  const appointments = shallowRef<AppointmentV1[]>([]);
  const customers = shallowRef<CustomerV1[]>([]);
  const displayMode = shallowRef<AppointmentCalendarDisplayMode>("month");
  const loading = shallowRef(false);
  const errorMessage = shallowRef("");
  const calendar = computed(() =>
    buildAppointmentMonthCalendar(
      monthCursor.value.getFullYear(),
      monthCursor.value.getMonth(),
      appointments.value,
    ),
  );
  const selectedAppointments = computed(
    () =>
      calendar.value.days.find(({ dateKey: key }) => key === selectedDateKey.value)
        ?.appointments ?? [],
  );
  const weekCalendar = computed(() =>
    buildAppointmentWeekCalendar(selectedDateKey.value, appointments.value),
  );

  async function refresh(): Promise<void> {
    loading.value = true;
    errorMessage.value = "";
    try {
      const data = await repository.readSnapshot();
      appointments.value = data.appointments;
      customers.value = data.customers;
    } catch {
      errorMessage.value = "预约月历读取失败，请稍后重试";
    } finally {
      loading.value = false;
    }
  }

  function selectDate(key: string): void {
    selectedDateKey.value = key;
    const selectedDate = dateFromKey(key);
    monthCursor.value = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  }

  function moveMonth(offset: number): void {
    const next = new Date(
      monthCursor.value.getFullYear(),
      monthCursor.value.getMonth() + offset,
      1,
    );
    monthCursor.value = next;
    selectedDateKey.value = dateKey(next);
  }

  /** 按当前视图切换相邻的自然周或自然月，并把选中日期带到目标周期。 */
  function movePeriod(offset: number): void {
    if (displayMode.value === "month") {
      moveMonth(offset);
      return;
    }
    const selectedDate = dateFromKey(selectedDateKey.value);
    selectedDate.setDate(selectedDate.getDate() + offset * 7);
    selectDate(dateKey(selectedDate));
  }

  function goToday(): void {
    const currentToday = today();
    monthCursor.value = new Date(currentToday.getFullYear(), currentToday.getMonth(), 1);
    selectedDateKey.value = dateKey(currentToday);
  }

  /** 收起月历为当前选中日期所在的一周。 */
  function collapseToWeek(): void {
    displayMode.value = "week";
  }

  /** 展开当前周所在的整月，并保持当前选中日期。 */
  function expandToMonth(): void {
    displayMode.value = "month";
    const selectedDate = dateFromKey(selectedDateKey.value);
    monthCursor.value = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  }

  return {
    calendar,
    weekCalendar,
    displayMode: readonly(displayMode),
    selectedDateKey: readonly(selectedDateKey),
    selectedAppointments,
    customers: readonly(customers),
    loading: readonly(loading),
    errorMessage: readonly(errorMessage),
    refresh,
    selectDate,
    goToday,
    previousPeriod: () => movePeriod(-1),
    nextPeriod: () => movePeriod(1),
    collapseToWeek,
    expandToMonth,
  };
}
