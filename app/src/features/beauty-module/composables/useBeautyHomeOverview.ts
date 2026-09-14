import { computed, readonly, shallowRef } from "vue";
import type { AppointmentV1, CustomerV1 } from "@/domain/data-schema";
import type { ApplicationDataRepository } from "@/repositories/application-data-repository";
import {
  deriveBeautyHomeOverview,
  type BeautyHomeOverview,
} from "@/services/statistics-service";

/** 首页只需要读取完整快照，不获得任何业务写入能力。 */
type BeautyHomeRepository = Pick<ApplicationDataRepository, "readSnapshot">;

/** 编排美容首页的派生统计读取；每次页面显示时由组合根主动刷新。 */
export function useBeautyHomeOverview(
  repository: BeautyHomeRepository,
  now: () => Date = () => new Date(),
) {
  const initialNow = now();
  const overview = shallowRef<BeautyHomeOverview>();
  const reportOverview = shallowRef<BeautyHomeOverview>();
  const appointments = shallowRef<readonly AppointmentV1[]>([]);
  const customers = shallowRef<CustomerV1[]>([]);
  const loading = shallowRef(false);
  const errorMessage = shallowRef("");
  const currentMonth = shallowRef(
    new Date(initialNow.getFullYear(), initialNow.getMonth(), 1),
  );
  const reportMonth = shallowRef(new Date(currentMonth.value));
  const canSelectNextReportMonth = computed(
    () => reportMonth.value.getTime() < currentMonth.value.getTime(),
  );

  /** 使用已读取的预约快照重算当前选中月份，切换月份时不重复访问存储。 */
  function refreshReportOverview(): void {
    reportOverview.value = deriveBeautyHomeOverview(
      appointments.value,
      reportMonth.value,
    );
  }

  /** 切换到上一个自然月并立即重算报表。 */
  function selectPreviousReportMonth(): void {
    reportMonth.value = new Date(
      reportMonth.value.getFullYear(),
      reportMonth.value.getMonth() - 1,
      1,
    );
    refreshReportOverview();
  }

  /** 切换到下一个自然月；当前月是允许查看的最晚月份。 */
  function selectNextReportMonth(): void {
    if (!canSelectNextReportMonth.value) return;
    const nextMonth = new Date(
      reportMonth.value.getFullYear(),
      reportMonth.value.getMonth() + 1,
      1,
    );
    reportMonth.value =
      nextMonth.getTime() > currentMonth.value.getTime()
        ? new Date(currentMonth.value)
        : nextMonth;
    refreshReportOverview();
  }

  async function refresh(): Promise<void> {
    loading.value = true;
    errorMessage.value = "";
    try {
      const data = await repository.readSnapshot();
      const refreshedAt = now();
      currentMonth.value = new Date(
        refreshedAt.getFullYear(),
        refreshedAt.getMonth(),
        1,
      );
      if (reportMonth.value.getTime() > currentMonth.value.getTime()) {
        reportMonth.value = new Date(currentMonth.value);
      }
      appointments.value = data.appointments;
      overview.value = deriveBeautyHomeOverview(data.appointments, refreshedAt);
      refreshReportOverview();
      customers.value = data.customers;
    } catch {
      errorMessage.value = "首页经营数据读取失败，请稍后重试";
    } finally {
      loading.value = false;
    }
  }

  return {
    overview: readonly(overview),
    reportOverview: readonly(reportOverview),
    reportMonth: readonly(reportMonth),
    canSelectNextReportMonth,
    customers: readonly(customers),
    loading: readonly(loading),
    errorMessage: readonly(errorMessage),
    refresh,
    selectPreviousReportMonth,
    selectNextReportMonth,
  };
}
