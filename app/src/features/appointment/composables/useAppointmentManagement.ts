import { computed, readonly, shallowRef } from "vue";
import type {
  AppointmentV1,
  BeautyProjectV1,
  CustomerV1,
  InventoryItemV1,
} from "@/domain/data-schema";
import {
  AppointmentTimeConflictError,
  type CancelAppointmentInput,
  type CompleteAppointmentInput,
  type AppointmentManagementService,
  type SavePendingAppointmentInput,
} from "@/services/appointment-management-service";

export type AppointmentSaveResult =
  /** 已保存并完成读回刷新。 */
  | { kind: "saved" }
  /** 需要用户确认的时间冲突，不属于数据保存失败。 */
  | { kind: "conflict"; input: SavePendingAppointmentInput; count: number }
  /** 规则或 I/O 失败，具体原因已写入 errorMessage。 */
  | { kind: "failed" };

/** 编排预约页读取、保存和“冲突后确认继续”状态。 */
export function useAppointmentManagement(
  service: AppointmentManagementService,
) {
  const customers = shallowRef<CustomerV1[]>([]);
  const projects = shallowRef<BeautyProjectV1[]>([]);
  const appointments = shallowRef<AppointmentV1[]>([]);
  const inventoryItems = shallowRef<InventoryItemV1[]>([]);
  const loading = shallowRef(false);
  const submitting = shallowRef(false);
  const errorMessage = shallowRef("");
  const errorKind = shallowRef<"" | "read" | "operation">("");
  const activeCustomers = computed(() =>
    customers.value.filter((customer) => customer.status === "active"),
  );
  const activeProjects = computed(() =>
    projects.value.filter((project) => project.status === "active"),
  );
  const activeInventoryItems = computed(() =>
    inventoryItems.value.filter((item) => item.status === "active"),
  );
  const pendingAppointments = computed(() =>
    appointments.value
      .filter((appointment) => appointment.status === "pending")
      .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt)),
  );
  const appointmentsByStatus = computed(() => {
    const statusOrder: Record<AppointmentV1["status"], number> = {
      pending: 0,
      completed: 1,
      cancelled: 2,
    };
    return [...appointments.value].sort(
      (left, right) =>
        statusOrder[left.status] - statusOrder[right.status] ||
        (left.status === "pending"
          ? left.scheduledAt.localeCompare(right.scheduledAt)
          : right.updatedAt.localeCompare(left.updatedAt)),
    );
  });

  async function refresh(): Promise<void> {
    loading.value = true;
    errorMessage.value = "";
    errorKind.value = "";
    try {
      const data = await service.readData();
      customers.value = data.customers;
      projects.value = data.projects;
      appointments.value = data.appointments;
      inventoryItems.value = data.inventoryItems;
    } catch {
      errorKind.value = "read";
      errorMessage.value = "预约资料读取失败，为避免覆盖原数据，请返回后重试";
    } finally {
      loading.value = false;
    }
  }

  async function savePendingAppointment(
    input: SavePendingAppointmentInput,
  ): Promise<AppointmentSaveResult> {
    submitting.value = true;
    errorMessage.value = "";
    errorKind.value = "";
    try {
      await service.savePendingAppointment(input);
      await refresh();
      return { kind: "saved" };
    } catch (error) {
      if (error instanceof AppointmentTimeConflictError) {
        return { kind: "conflict", input, count: error.conflicts.length };
      }
      errorMessage.value =
        error instanceof Error ? error.message : "预约保存失败，请稍后重试";
      errorKind.value = "operation";
      return { kind: "failed" };
    } finally {
      submitting.value = false;
    }
  }

  async function runStatusMutation(
    operation: () => Promise<unknown>,
    fallbackMessage: string,
  ): Promise<boolean> {
    submitting.value = true;
    errorMessage.value = "";
    errorKind.value = "";
    try {
      await operation();
      await refresh();
      return true;
    } catch (error) {
      errorKind.value = "operation";
      errorMessage.value =
        error instanceof Error ? error.message : fallbackMessage;
      return false;
    } finally {
      submitting.value = false;
    }
  }

  return {
    customers: readonly(customers),
    projects: readonly(projects),
    inventoryItems: readonly(inventoryItems),
    activeCustomers,
    activeProjects,
    activeInventoryItems,
    pendingAppointments,
    appointmentsByStatus,
    loading: readonly(loading),
    submitting: readonly(submitting),
    errorMessage: readonly(errorMessage),
    errorKind: readonly(errorKind),
    refresh,
    savePendingAppointment,
    cancelAppointment: (input: CancelAppointmentInput) =>
      runStatusMutation(
        () => service.cancelAppointment(input),
        "预约取消失败，请稍后重试",
      ),
    restoreCancelledAppointment: (appointmentId: string) =>
      runStatusMutation(
        () => service.restoreCancelledAppointment(appointmentId),
        "恢复取消失败，请稍后重试",
      ),
    completeAppointment: (input: CompleteAppointmentInput) =>
      runStatusMutation(
        () => service.completeAppointment(input),
        "预约完成失败，请稍后重试",
      ),
    correctCompletedAppointment: (input: CompleteAppointmentInput) =>
      runStatusMutation(
        () => service.correctCompletedAppointment(input),
        "完成信息更正失败，请稍后重试",
      ),
    revertCompletedAppointment: (appointmentId: string) =>
      runStatusMutation(
        () => service.revertCompletedAppointment(appointmentId),
        "撤销完成失败，请稍后重试",
      ),
    deleteAppointment: (appointmentId: string) =>
      runStatusMutation(
        () => service.deleteAppointment(appointmentId),
        "预约删除失败，请稍后重试",
      ),
  };
}
