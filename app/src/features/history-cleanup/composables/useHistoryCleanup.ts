import { computed, readonly, shallowRef } from "vue";
import type { HistoryCleanupService } from "@/services/history-cleanup-service";

function todayLocalDate(): string {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

export function useHistoryCleanup(service: HistoryCleanupService) {
  const cutoffDate = shallowRef(todayLocalDate());
  const records = shallowRef<
    Awaited<ReturnType<HistoryCleanupService["readHistory"]>>["records"]
  >([]);
  const total = shallowRef(0);
  const loading = shallowRef(false);
  const deletingId = shallowRef("");
  const errorMessage = shallowRef("");
  const deleting = computed(() => deletingId.value !== "");
  const hasMore = computed(() => records.value.length < total.value);

  async function refresh(): Promise<void> {
    loading.value = true;
    errorMessage.value = "";
    try {
      const page = await service.readHistory(cutoffDate.value);
      records.value = page.records;
      total.value = page.total;
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : "预约历史读取失败，请稍后重试";
    } finally {
      loading.value = false;
    }
  }

  async function loadMore(): Promise<void> {
    if (loading.value || !hasMore.value) {
      return;
    }
    loading.value = true;
    errorMessage.value = "";
    try {
      const page = await service.readHistory(
        cutoffDate.value,
        records.value.length,
      );
      records.value = [...records.value, ...page.records];
      total.value = page.total;
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : "更多预约历史读取失败，请稍后重试";
    } finally {
      loading.value = false;
    }
  }

  async function deleteRecord(
    record: Parameters<HistoryCleanupService["deleteHistoryAppointment"]>[0],
  ): Promise<boolean> {
    deletingId.value = record.appointmentId;
    errorMessage.value = "";
    try {
      await service.deleteHistoryAppointment(record);
      await refresh();
      return true;
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : "预约历史删除失败，请稍后重试";
      return false;
    } finally {
      deletingId.value = "";
    }
  }

  return {
    cutoffDate,
    records: readonly(records),
    total: readonly(total),
    loading: readonly(loading),
    deletingId: readonly(deletingId),
    deleting,
    hasMore,
    errorMessage: readonly(errorMessage),
    refresh,
    loadMore,
    deleteRecord,
  };
}
