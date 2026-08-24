import { describe, expect, it, vi } from "vitest";
import type { ApplicationData } from "@/domain/data-schema";
import { applyBusinessDataMutation } from "@/repositories/business-data-mutation";
import { createAppointmentManagementService } from "./appointment-management-service";
import { createHistoryCleanupService } from "./history-cleanup-service";

const EXPORTED_AT = "2025-01-01T08:00:00.000Z";

function createData(): ApplicationData {
  const base = {
    schemaVersion: 1 as const,
    customerId: "customer-1",
    projectSnapshots: [
      {
        projectId: "project-1",
        name: "护理",
        standardPriceCents: 10_000,
        durationMinutes: 60,
      },
    ],
    actualUsages: [],
    estimatedDurationMinutes: 60,
    standardAmountCents: 10_000,
    serviceAddressSnapshot: { addressText: "测试地址" },
    createdAt: "2025-01-01T00:00:00.000Z",
  };
  return {
    schemaVersion: 1,
    settings: { schemaVersion: 1 },
    unlockedModules: ["beauty"],
    backupMetadata: {
      schemaVersion: 1,
      lastExportedAt: EXPORTED_AT,
      lastExportFileName: "backup.json",
    },
    inventoryItems: [],
    inventoryMovements: [],
    projects: [],
    customers: [
      {
        schemaVersion: 1,
        id: "customer-1",
        nickname: "林女士",
        phone: "13800000000",
        addresses: [],
        status: "active",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
    ],
    appointments: [
      {
        ...base,
        id: "pending-1",
        scheduledAt: "2025-01-10T04:00:00.000Z",
        status: "pending",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
      {
        ...base,
        id: "completed-1",
        scheduledAt: "2025-01-02T04:00:00.000Z",
        status: "completed",
        transactionAmountCents: 9_800,
        completedAt: "2025-01-02T06:00:00.000Z",
        updatedAt: "2025-01-02T06:00:00.000Z",
      },
      {
        ...base,
        id: "cancelled-1",
        scheduledAt: "2025-01-03T04:00:00.000Z",
        status: "cancelled",
        cancelReason: "改期",
        cancelledAt: "2025-01-03T06:00:00.000Z",
        updatedAt: "2025-01-03T06:00:00.000Z",
      },
    ],
  };
}

function createMockService(data = createData()) {
  const deleteAppointmentIfUnchanged = vi.fn(async () => undefined);
  return {
    service: createHistoryCleanupService({
      appointments: {
        async readData() { return data; },
        deleteAppointmentIfUnchanged,
      },
    }),
    deleteAppointmentIfUnchanged,
  };
}

describe("手动历史清理", () => {
  it("按日期只列出已完成和已取消预约，并返回窄视图分页", async () => {
    const { service } = createMockService();

    await expect(service.readHistory("2025-01-03", 0, 1)).resolves.toEqual({
      total: 2,
      records: [
        expect.objectContaining({
          appointmentId: "cancelled-1",
          status: "cancelled",
          customerNickname: "林女士",
        }),
      ],
    });
    await expect(service.readHistory("2025-01-02")).resolves.toMatchObject({
      total: 1,
      records: [{ appointmentId: "completed-1", status: "completed" }],
    });
  });

  it("没有完整备份时既不展示也不删除历史", async () => {
    const data = createData();
    data.backupMetadata = { schemaVersion: 1 };
    const { service, deleteAppointmentIfUnchanged } = createMockService(data);

    await expect(service.readHistory("2025-01-31")).rejects.toThrow("请先导出完整备份");
    await expect(service.deleteHistoryAppointment({
      appointmentId: "completed-1",
      status: "completed",
      expectedUpdatedAt: "2025-01-02T06:00:00.000Z",
    })).rejects.toThrow("请先导出完整备份");
    expect(deleteAppointmentIfUnchanged).not.toHaveBeenCalled();
  });

  it("删除时把列表捕获的状态和更新时间传给原子命令", async () => {
    const { service, deleteAppointmentIfUnchanged } = createMockService();
    const page = await service.readHistory("2025-01-31");
    const completed = page.records.find(({ appointmentId }) => appointmentId === "completed-1");

    await service.deleteHistoryAppointment(completed!);

    expect(deleteAppointmentIfUnchanged).toHaveBeenCalledWith({
      appointmentId: "completed-1",
      expectedStatus: "completed",
      expectedUpdatedAt: "2025-01-02T06:00:00.000Z",
    });
  });

  it("读取后预约变回待执行时，原子删除拒绝并保留预约", async () => {
    let data = createData();
    const appointmentService = createAppointmentManagementService({
      repository: {
        async readSnapshot() { return data; },
        async applyBusinessMutation(mutation) {
          data = applyBusinessDataMutation(
            data,
            mutation,
            "2025-01-04T00:00:00.000Z",
          );
        },
      },
      now: () => new Date("2025-01-04T00:00:00.000Z"),
    });
    const service = createHistoryCleanupService({ appointments: appointmentService });
    const page = await service.readHistory("2025-01-31");
    const completed = page.records.find(({ appointmentId }) => appointmentId === "completed-1")!;
    const old = data.appointments.find(({ id }) => id === "completed-1")!;
    data = {
      ...data,
      appointments: data.appointments.map((appointment) =>
        appointment.id === old.id
          ? {
              schemaVersion: 1,
              id: old.id,
              customerId: old.customerId,
              projectSnapshots: old.projectSnapshots,
              actualUsages: old.actualUsages,
              scheduledAt: old.scheduledAt,
              estimatedDurationMinutes: old.estimatedDurationMinutes,
              standardAmountCents: old.standardAmountCents,
              serviceAddressSnapshot: old.serviceAddressSnapshot,
              status: "pending",
              createdAt: old.createdAt,
              updatedAt: old.updatedAt,
            }
          : appointment,
      ),
    };

    await expect(service.deleteHistoryAppointment(completed)).rejects.toThrow("预约状态已变化");
    expect(data.appointments.find(({ id }) => id === "completed-1")?.status).toBe("pending");
  });

  it("拒绝无效日期和分页参数", async () => {
    const { service } = createMockService();
    await expect(service.readHistory("2025-02-30")).rejects.toThrow("有效的截止日期");
    await expect(service.readHistory("2025-01-31", -1)).rejects.toThrow("分页参数无效");
  });
});
