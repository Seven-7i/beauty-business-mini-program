import { describe, expect, it } from "vitest";
import type { ApplicationData } from "@/domain/data-schema";
import { applyBusinessDataMutation } from "@/repositories/business-data-mutation";
import {
  AppointmentTimeConflictError,
  createAppointmentManagementService,
  type AppointmentManagementRepository,
} from "./appointment-management-service";

const NOW = "2026-08-08T12:00:00.000Z";

function createData(): ApplicationData {
  return {
    schemaVersion: 1,
    settings: { schemaVersion: 1 },
    unlockedModules: ["beauty"],
    backupMetadata: { schemaVersion: 1 },
    inventoryItems: [
      {
        id: "item-1",
        name: "精华液",
        unit: "毫升",
        unitKind: "continuous",
        currentQuantity: "10",
        status: "active",
        createdAt: NOW,
        updatedAt: NOW,
        schemaVersion: 1,
      },
    ],
    inventoryMovements: [],
    projects: [
      {
        id: "project-1",
        name: "补水护理",
        standardPriceCents: 8800,
        durationMinutes: 60,
        defaultUsages: [{ inventoryItemId: "item-1", quantity: "2" }],
        status: "active",
        createdAt: NOW,
        updatedAt: NOW,
        schemaVersion: 1,
      },
    ],
    customers: [
      {
        id: "customer-1",
        nickname: "小雨",
        phone: "13800138000",
        addresses: [{ id: "address-1", addressText: "建设路 8 号" }],
        status: "active",
        createdAt: NOW,
        updatedAt: NOW,
        schemaVersion: 1,
      },
    ],
    appointments: [],
  };
}

/** 内存仓储仍执行真实命令复核，覆盖用例与原子 seam 的组合。 */
function createMemoryRepository(initial = createData()) {
  let data = initial;
  const repository: AppointmentManagementRepository = {
    async readSnapshot() {
      return data;
    },
    async applyBusinessMutation(mutation) {
      data = applyBusinessDataMutation(data, mutation, NOW);
    },
  };
  return {
    repository,
    readData: () => data,
    /** 模拟预约读取后，关联对象被其他管理入口停用或改名。 */
    replaceData: (next: ApplicationData) => {
      data = next;
    },
  };
}

function createInput(confirmTimeConflict = false) {
  return {
    customerId: "customer-1",
    projectIds: ["project-1"],
    scheduledAt: "2026-08-09T10:00:00.000Z",
    serviceAddress: { addressText: "建设路 8 号" },
    confirmTimeConflict,
  };
}

describe("待执行预约管理用例", () => {
  it("按最新顾客、项目和库存版本原子新增待执行预约", async () => {
    const memory = createMemoryRepository();
    const service = createAppointmentManagementService({
      repository: memory.repository,
      now: () => new Date(NOW),
      createId: () => "appointment-1",
    });

    const appointment = await service.savePendingAppointment(createInput());

    expect(appointment).toMatchObject({
      id: "appointment-1",
      status: "pending",
      standardAmountCents: 8800,
      estimatedDurationMinutes: 60,
      actualUsages: [{ inventoryItemId: "item-1", quantity: "2" }],
    });
    expect(memory.readData().appointments).toEqual([appointment]);
    expect(memory.readData().inventoryItems[0]?.currentQuantity).toBe("10");
  });

  it("时间冲突先返回可确认警告，明确确认后允许保存", async () => {
    const memory = createMemoryRepository();
    const service = createAppointmentManagementService({
      repository: memory.repository,
      now: () => new Date(NOW),
      createId: (() => {
        let index = 0;
        return () => `appointment-${++index}`;
      })(),
    });
    await service.savePendingAppointment(createInput());

    await expect(
      service.savePendingAppointment({
        ...createInput(),
        scheduledAt: "2026-08-09T10:30:00.000Z",
      }),
    ).rejects.toBeInstanceOf(AppointmentTimeConflictError);
    expect(memory.readData().appointments).toHaveLength(1);

    await service.savePendingAppointment({
      ...createInput(true),
      scheduledAt: "2026-08-09T10:30:00.000Z",
    });
    expect(memory.readData().appointments).toHaveLength(2);
  });

  it("编辑待执行预约保留标识和创建时间并排除自身占用", async () => {
    const memory = createMemoryRepository();
    const service = createAppointmentManagementService({
      repository: memory.repository,
      now: () => new Date(NOW),
      createId: () => "appointment-1",
    });
    const created = await service.savePendingAppointment(createInput());

    const updated = await service.savePendingAppointment({
      ...createInput(),
      appointmentId: created.id,
      actualUsageInputs: [
        { inventoryItemId: "item-1", quantityInput: "10" },
      ],
      scheduledAt: "2026-08-10T10:00:00.000Z",
    });

    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.actualUsages[0]?.quantity).toBe("10");
    expect(memory.readData().appointments).toEqual([updated]);
  });

  it("编辑旧预约可保留后来停用的原引用及历史快照", async () => {
    const memory = createMemoryRepository();
    const service = createAppointmentManagementService({
      repository: memory.repository,
      now: () => new Date(NOW),
      createId: () => "appointment-1",
    });
    const created = await service.savePendingAppointment(createInput());
    memory.replaceData({
      ...memory.readData(),
      customers: memory.readData().customers.map((current) => ({
        ...current,
        nickname: "新昵称",
        status: "inactive",
        updatedAt: "2026-08-08T12:10:00.000Z",
      })),
      projects: memory.readData().projects.map((current) => ({
        ...current,
        name: "新项目名",
        standardPriceCents: 9900,
        status: "inactive",
        updatedAt: "2026-08-08T12:10:00.000Z",
      })),
      inventoryItems: memory.readData().inventoryItems.map((current) => ({
        ...current,
        name: "新物品名",
        status: "inactive",
        updatedAt: "2026-08-08T12:10:00.000Z",
      })),
    });

    const updated = await service.savePendingAppointment({
      ...createInput(),
      appointmentId: created.id,
      scheduledAt: "2026-08-10T11:00:00.000Z",
      serviceAddress: { addressText: "改期后的地址" },
    });

    expect(updated.projectSnapshots).toEqual(created.projectSnapshots);
    expect(updated.standardAmountCents).toBe(created.standardAmountCents);
    expect(updated.actualUsages).toEqual(created.actualUsages);
    expect(updated.serviceAddressSnapshot.addressText).toBe("改期后的地址");
  });

  it("取消预约不扣库存，并可在库存足够时恢复取消", async () => {
    const memory = createMemoryRepository();
    const service = createAppointmentManagementService({
      repository: memory.repository,
      now: () => new Date(NOW),
      createId: () => "appointment-1",
    });
    const created = await service.savePendingAppointment(createInput());

    const cancelled = await service.cancelAppointment({
      appointmentId: created.id,
      cancelReason: " 临时改期 ",
    });
    expect(cancelled).toMatchObject({
      status: "cancelled",
      cancelReason: "临时改期",
    });
    expect(memory.readData().inventoryItems[0]?.currentQuantity).toBe("10");
    expect(memory.readData().inventoryMovements).toEqual([]);

    const restored = await service.restoreCancelledAppointment(created.id);
    expect(restored.status).toBe("pending");
    expect(restored).not.toHaveProperty("cancelledAt");
  });

  it("完成预约精确转成交金额并原子生成库存消耗", async () => {
    const memory = createMemoryRepository();
    const service = createAppointmentManagementService({
      repository: memory.repository,
      now: () => new Date(NOW),
      createId: () => "appointment-1",
      createMovementId: () => "movement-consumption-1",
    });
    const created = await service.savePendingAppointment(createInput());

    const completed = await service.completeAppointment({
      appointmentId: created.id,
      transactionAmountInput: "82.50",
      completedAt: "2026-08-09T12:30:00.000Z",
      actualUsageInputs: [
        { inventoryItemId: "item-1", quantityInput: "2.5" },
      ],
      note: " 服务完成 ",
    });

    expect(completed).toMatchObject({
      status: "completed",
      transactionAmountCents: 8250,
      completedAt: "2026-08-09T12:30:00.000Z",
      note: "服务完成",
    });
    expect(memory.readData().inventoryItems[0]?.currentQuantity).toBe("7.5");
    expect(memory.readData().inventoryMovements).toEqual([
      expect.objectContaining({
        id: "movement-consumption-1",
        type: "appointment-consumption",
        deltaQuantity: "-2.5",
        appointmentId: created.id,
      }),
    ]);

    const corrected = await service.correctCompletedAppointment({
      appointmentId: created.id,
      transactionAmountInput: "90",
      completedAt: "2026-08-09T13:00:00.000Z",
      actualUsageInputs: [
        { inventoryItemId: "item-1", quantityInput: "1.5" },
      ],
      note: "更正完成信息",
    });
    expect(corrected).toMatchObject({
      status: "completed",
      transactionAmountCents: 9000,
      completedAt: "2026-08-09T13:00:00.000Z",
      actualUsages: [{ inventoryItemId: "item-1", quantity: "1.5" }],
    });
    expect(memory.readData().inventoryItems[0]?.currentQuantity).toBe("8.5");
    expect(memory.readData().inventoryMovements).toEqual([
      expect.objectContaining({
        id: "movement-consumption-1",
        deltaQuantity: "-1.5",
      }),
    ]);

    const reverted = await service.revertCompletedAppointment(created.id);
    expect(reverted.status).toBe("pending");
    expect(memory.readData().inventoryItems[0]?.currentQuantity).toBe("10");
    expect(memory.readData().inventoryMovements).toEqual([]);

    await service.deleteAppointment(created.id);
    expect(memory.readData().appointments).toEqual([]);
  });

  it("无效成交金额不会改变预约或库存", async () => {
    const memory = createMemoryRepository();
    const service = createAppointmentManagementService({
      repository: memory.repository,
      now: () => new Date(NOW),
      createId: () => "appointment-1",
    });
    const created = await service.savePendingAppointment(createInput());

    await expect(
      service.completeAppointment({
        appointmentId: created.id,
        transactionAmountInput: "82.999",
        completedAt: NOW,
        actualUsageInputs: [
          { inventoryItemId: "item-1", quantityInput: "2" },
        ],
      }),
    ).rejects.toThrow("最多两位小数");
    expect(memory.readData().appointments[0]?.status).toBe("pending");
    expect(memory.readData().inventoryItems[0]?.currentQuantity).toBe("10");
    expect(memory.readData().inventoryMovements).toEqual([]);
  });
});
