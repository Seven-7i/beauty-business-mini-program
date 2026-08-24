import type {
  AppointmentV1,
  CancelledAppointmentV1,
  CompletedAppointmentV1,
  IsoDateTimeString,
} from "@/domain/data-schema";
import type { AppointmentManagementService } from "@/services/appointment-management-service";

export interface HistoryCleanupRecord {
  appointmentId: string;
  status: "completed" | "cancelled";
  expectedUpdatedAt: IsoDateTimeString;
  customerNickname: string;
  occurredAt: IsoDateTimeString;
  projectNames: readonly string[];
  addressText: string;
}

export interface HistoryCleanupPage {
  records: readonly HistoryCleanupRecord[];
  total: number;
}

export interface HistoryCleanupServiceOptions {
  appointments: Pick<
    AppointmentManagementService,
    "readData" | "deleteAppointmentIfUnchanged"
  >;
}

function localDateKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("预约历史时间无效");
  }
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

type HistoryAppointment = CompletedAppointmentV1 | CancelledAppointmentV1;

function isHistoryAppointment(
  appointment: AppointmentV1,
): appointment is HistoryAppointment {
  return appointment.status === "completed" || appointment.status === "cancelled";
}

function historyOccurredAt(appointment: HistoryAppointment): IsoDateTimeString {
  return appointment.status === "completed"
    ? appointment.completedAt
    : appointment.cancelledAt;
}

function requireDateKey(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("请选择有效的截止日期");
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error("请选择有效的截止日期");
  }
}

/** 容量清理只暴露历史记录，待执行预约不属于可清理集合。 */
export function createHistoryCleanupService(
  options: HistoryCleanupServiceOptions,
) {
  const { appointments } = options;

  async function readHistory(
    cutoffDate: string,
    offset = 0,
    limit = 20,
  ): Promise<HistoryCleanupPage> {
    requireDateKey(cutoffDate);
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit <= 0) {
      throw new Error("历史分页参数无效");
    }
    const data = await appointments.readData();
    if (!data.backupMetadata.lastExportedAt) {
      throw new Error("请先导出完整备份，再清理预约历史");
    }
    const customerNames = new Map(
      data.customers.map(({ id, nickname }) => [id, nickname]),
    );
    const allRecords = data.appointments
      .filter(isHistoryAppointment)
      .map((appointment) => ({
        appointmentId: appointment.id,
        status: appointment.status,
        expectedUpdatedAt: appointment.updatedAt,
        customerNickname: customerNames.get(appointment.customerId) ?? "顾客资料不可用",
        occurredAt: historyOccurredAt(appointment),
        projectNames: appointment.projectSnapshots.map(({ name }) => name),
        addressText: appointment.serviceAddressSnapshot.addressText,
      }))
      .filter(({ occurredAt }) => localDateKey(occurredAt) <= cutoffDate)
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
    return {
      records: allRecords.slice(offset, offset + limit),
      total: allRecords.length,
    };
  }

  async function deleteHistoryAppointment(
    record: Pick<
      HistoryCleanupRecord,
      "appointmentId" | "status" | "expectedUpdatedAt"
    >,
  ): Promise<void> {
    const data = await appointments.readData();
    if (!data.backupMetadata.lastExportedAt) {
      throw new Error("请先导出完整备份，再清理预约历史");
    }
    await appointments.deleteAppointmentIfUnchanged({
      appointmentId: record.appointmentId,
      expectedStatus: record.status,
      expectedUpdatedAt: record.expectedUpdatedAt,
    });
  }

  return { readHistory, deleteHistoryAppointment };
}

export type HistoryCleanupService = ReturnType<
  typeof createHistoryCleanupService
>;
