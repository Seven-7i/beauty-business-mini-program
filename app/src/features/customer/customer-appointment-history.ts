import type { DeepReadonly } from "vue";
import type { AppointmentV1 } from "@/domain/data-schema";

/**
 * 顾客详情只展示仍存在的预约源记录，按计划时间从近到远排列。
 * 返回新数组，避免详情页排序改变管理页的预约顺序。
 */
export function deriveCustomerAppointmentHistory<
  TAppointment extends DeepReadonly<AppointmentV1>,
>(
  customerId: string,
  appointments: readonly TAppointment[],
): TAppointment[] {
  return appointments
    .filter((appointment) => appointment.customerId === customerId)
    .sort(
      (left, right) =>
        right.scheduledAt.localeCompare(left.scheduledAt) ||
        right.updatedAt.localeCompare(left.updatedAt) ||
        right.id.localeCompare(left.id),
    );
}
