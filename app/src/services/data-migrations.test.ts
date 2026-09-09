import { describe, expect, it } from "vitest";
import type { ApplicationData } from "@/domain/data-schema";
import {
  DataMigrationError,
  migrateApplicationData,
} from "./data-migrations";

const CREATED_AT = "2026-08-06T02:00:00.000Z";
const UPDATED_AT = "2026-08-06T03:00:00.000Z";

function createValidData(): ApplicationData {
  return {
    schemaVersion: 2,
    settings: { schemaVersion: 1, defaultModuleId: "beauty" },
    unlockedModules: ["beauty"],
    backupMetadata: {
      schemaVersion: 1,
      firstBusinessDataAt: CREATED_AT,
      lastExportedAt: UPDATED_AT,
      lastExportFileName: "美容管家备份_20260806_1100.json",
      lastReminderDate: "2026-08-06",
    },
    inventoryItems: [
      {
        id: "item-1",
        name: "面膜",
        unit: "片",
        unitKind: "discrete",
        currentQuantity: "2",
        status: "active",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
        schemaVersion: 1,
      },
    ],
    inventoryMovements: [
      {
        id: "movement-1",
        inventoryItemId: "item-1",
        type: "appointment-consumption",
        beforeQuantity: "3",
        deltaQuantity: "-1",
        afterQuantity: "2",
        occurredAt: UPDATED_AT,
        appointmentId: "appointment-1",
        appointmentDeleted: false,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
        schemaVersion: 1,
      },
    ],
    projects: [
      {
        id: "project-1",
        name: "基础护理",
        standardPriceCents: 12000,
        durationMinutes: 60,
        defaultUsages: [{ inventoryItemId: "item-1", quantity: "1" }],
        status: "active",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
        schemaVersion: 1,
      },
    ],
    customers: [
      {
        id: "customer-1",
        nickname: "小庄",
        phone: "13800138000",
        addresses: [
          {
            id: "address-1",
            addressText: "上海市测试路 1 号",
            note: "到门口联系",
          },
        ],
        status: "active",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
        schemaVersion: 1,
      },
    ],
    appointments: [
      {
        id: "appointment-1",
        customerId: "customer-1",
        projectSnapshots: [
          {
            projectId: "project-1",
            name: "基础护理",
            standardPriceCents: 12000,
            durationMinutes: 60,
          },
        ],
        standardAmountCents: 12000,
        estimatedDurationMinutes: 60,
        actualUsages: [
          {
            inventoryItemId: "item-1",
            itemNameSnapshot: "面膜",
            unitSnapshot: "片",
            quantity: "1",
          },
        ],
        scheduledAt: "2026-08-06T04:00:00.000Z",
        serviceAddressSnapshot: {
          addressText: "上海市测试路 1 号",
          note: "到门口联系",
        },
        status: "completed",
        transactionAmountCents: 10000,
        completedAt: "2026-08-06T05:00:00.000Z",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
        schemaVersion: 2,
      },
    ],
  };
}

function expectMigrationError(
  action: () => unknown,
  expected: { code: DataMigrationError["code"]; path: string },
): void {
  try {
    action();
    throw new Error("预期 migration 失败，但实际成功");
  } catch (error) {
    expect(error).toBeInstanceOf(DataMigrationError);
    expect(error).toMatchObject(expected);
  }
}

describe("应用数据 migrations", () => {
  it("把阶段 0 未版本化模块设置迁移为当前空业务快照", () => {
    const source = {
      unlockedModules: ["beauty"],
      defaultModuleId: "beauty",
    };

    expect(migrateApplicationData(source)).toEqual({
      schemaVersion: 2,
      settings: { schemaVersion: 1, defaultModuleId: "beauty" },
      unlockedModules: ["beauty"],
      backupMetadata: { schemaVersion: 1 },
      inventoryItems: [],
      inventoryMovements: [],
      projects: [],
      customers: [],
      appointments: [],
    });
  });

  it("校验 v2 完整快照并返回不共享嵌套引用的新对象", () => {
    const source = createValidData();

    const result = migrateApplicationData(source);

    expect(result).toEqual(source);
    expect(result).not.toBe(source);
    expect(result.inventoryItems).not.toBe(source.inventoryItems);
    expect(result.appointments[0]).not.toBe(source.appointments[0]);
  });

  it("把 v1 预约快照升级为 v2 并为预约写入新实体版本", () => {
    const source = structuredClone(createValidData()) as unknown as {
      schemaVersion: number;
      appointments: Array<{ schemaVersion: number }>;
    };
    source.schemaVersion = 1;
    source.appointments[0]!.schemaVersion = 1;

    const result = migrateApplicationData(source);

    expect(result.schemaVersion).toBe(2);
    expect(result.appointments[0]?.schemaVersion).toBe(2);
    expect(result.appointments[0]).not.toHaveProperty("recordOrigin");
  });

  it("v1 无取消原因记录迁移后补历史占位且可再次按 v2 读取", () => {
    const source = structuredClone(createValidData()) as unknown as {
      schemaVersion: number;
      appointments: Array<Record<string, unknown>>;
    };
    source.schemaVersion = 1;
    const appointment = source.appointments[0]!;
    appointment.schemaVersion = 1;
    appointment.status = "cancelled";
    appointment.cancelledAt = UPDATED_AT;
    delete appointment.transactionAmountCents;
    delete appointment.completedAt;
    delete appointment.cancelReason;

    const migrated = migrateApplicationData(source);

    expect(migrated.appointments[0]).toMatchObject({
      status: "cancelled",
      cancelReason: "历史记录未填写取消原因",
      schemaVersion: 2,
    });
    expect(migrateApplicationData(migrated)).toEqual(migrated);
  });

  it("允许停用物品和项目与启用对象重名，历史记录仍保留", () => {
    const source = createValidData();
    source.inventoryItems.push({
      ...source.inventoryItems[0]!,
      id: "item-inactive",
      status: "inactive",
    });
    source.projects.push({
      ...source.projects[0]!,
      id: "project-inactive",
      status: "inactive",
    });

    expect(migrateApplicationData(source)).toMatchObject({
      inventoryItems: [{ status: "active" }, { status: "inactive" }],
      projects: [{ status: "active" }, { status: "inactive" }],
    });
  });

  it("拒绝未来版本，避免旧应用覆盖新版本数据", () => {
    expectMigrationError(
      () => migrateApplicationData({ schemaVersion: 3 }),
      { code: "future-version", path: "$.schemaVersion" },
    );
  });

  it("拒绝未版本化数据中的未知业务字段，避免迁移时静默丢失", () => {
    expectMigrationError(
      () =>
        migrateApplicationData({
          unlockedModules: ["beauty"],
          customers: [{ id: "legacy-customer" }],
        }),
      { code: "invalid-data", path: "$.customers" },
    );
  });

  it("拒绝 v2 中无法识别的字段，避免恢复时静默丢失", () => {
    const source = createValidData() as ApplicationData & {
      futureField?: string;
    };
    source.futureField = "must-not-be-dropped";

    expectMigrationError(() => migrateApplicationData(source), {
      code: "invalid-data",
      path: "$.futureField",
    });
  });

  it("发现无效定点数量时指出准确字段且不修改输入", () => {
    const source: unknown = createValidData();
    (source as ApplicationData).inventoryItems[0].currentQuantity = "1.5";
    const before = JSON.stringify(source);

    expectMigrationError(() => migrateApplicationData(source), {
      code: "invalid-data",
      path: "$.inventoryItems[0].currentQuantity",
    });
    expect(JSON.stringify(source)).toBe(before);
  });

  it("拒绝引用不存在库存物品的项目默认用量", () => {
    const source = createValidData();
    source.projects[0].defaultUsages[0].inventoryItemId = "missing-item";

    expectMigrationError(() => migrateApplicationData(source), {
      code: "invalid-data",
      path: "$.projects[0].defaultUsages[0].inventoryItemId",
    });
  });

  it("拒绝与预约状态冲突的完成字段", () => {
    const source = createValidData() as unknown as Record<string, unknown>;
    const appointments = source.appointments as Array<Record<string, unknown>>;
    appointments[0].status = "pending";

    expectMigrationError(() => migrateApplicationData(source), {
      code: "invalid-data",
      path: "$.appointments[0].transactionAmountCents",
    });
  });

  it("拒绝 v2 待执行记录携带后补标识", () => {
    const source = createValidData() as unknown as Record<string, unknown>;
    const appointment = (
      source.appointments as Array<Record<string, unknown>>
    )[0]!;
    appointment.status = "pending";
    appointment.recordOrigin = "backfilled";
    delete appointment.transactionAmountCents;
    delete appointment.completedAt;

    expectMigrationError(() => migrateApplicationData(source), {
      code: "invalid-data",
      path: "$.appointments[0].recordOrigin",
    });
  });

  it("拒绝 v2 已取消记录缺少取消原因", () => {
    const source = createValidData() as unknown as Record<string, unknown>;
    const appointment = (
      source.appointments as Array<Record<string, unknown>>
    )[0]!;
    appointment.status = "cancelled";
    appointment.cancelledAt = UPDATED_AT;
    delete appointment.transactionAmountCents;
    delete appointment.completedAt;

    expectMigrationError(() => migrateApplicationData(source), {
      code: "invalid-data",
      path: "$.appointments[0].cancelReason",
    });
  });
});
