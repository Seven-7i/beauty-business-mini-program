import { computed, readonly, shallowRef } from "vue";
import type { AppointmentV1, CustomerV1 } from "@/domain/data-schema";
import type { ApplicationDataRepository } from "@/repositories/application-data-repository";
import { buildAppointmentMonthCalendar } from "@/services/appointment-calendar-service";

type AppointmentCalendarRepository = Pick<ApplicationDataRepository, "readSnapshot">;

function dateKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

/** 编排月历月份切换、日期选择和本机预约读取。 */
export function useAppointmentCalendar(
  repository: AppointmentCalendarRepository,
  today: () => Date = () => new Date(),
) {
  const initialDate = today();
  const monthCursor = shallowRef(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const selectedDateKey = shallowRef(dateKey(initialDate));
  const appointments = shallowRef<AppointmentV1[]>([]);
  const customers = shallowRef<CustomerV1[]>([]);
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

  function moveMonth(offset: number): void {
    const next = new Date(
      monthCursor.value.getFullYear(),
      monthCursor.value.getMonth() + offset,
      1,
    );
    monthCursor.value = next;
    selectedDateKey.value = dateKey(next);
  }

  return {
    calendar,
    selectedDateKey: readonly(selectedDateKey),
    selectedAppointments,
    customers: readonly(customers),
    loading: readonly(loading),
    errorMessage: readonly(errorMessage),
    refresh,
    selectDate: (key: string) => {
      selectedDateKey.value = key;
    },
    previousMonth: () => moveMonth(-1),
    nextMonth: () => moveMonth(1),
  };
}
