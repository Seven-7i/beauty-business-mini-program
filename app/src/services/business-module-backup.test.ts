import { describe, expect, it } from "vitest";
import type { ApplicationData } from "@/domain/data-schema";
import {
  beautyModuleBackupHandler,
  getBusinessModuleBackupHandler,
} from "./business-module-backup";

const CREATED_AT = "2026-08-09T08:00:00.000Z";

function createData(): ApplicationData {
  return {
    schemaVersion: 1,
    settings: { schemaVersion: 1, defaultModuleId: "beauty" },
    unlockedModules: ["beauty"],
    backupMetadata: {
      schemaVersion: 1,
      lastExportedAt: CREATED_AT,
    },
    inventoryItems: [
      {
        id: "item-1",
        name: "精华液",
        unit: "瓶",
        unitKind: "discrete",
        currentQuantity: "2",
        status: "active",
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
        schemaVersion: 1,
      },
    ],
    inventoryMovements: [],
    projects: [],
    customers: [],
    appointments: [],
  };
}

describe("业务模块备份处理器", () => {
  it("美容处理器只提取美容数据，不携带设置、授权和备份元数据", () => {
    const extracted = beautyModuleBackupHandler.extract(createData());

    expect(extracted.inventoryItems).toHaveLength(1);
    expect(extracted).not.toHaveProperty("settings");
    expect(extracted).not.toHaveProperty("unlockedModules");
    expect(extracted).not.toHaveProperty("backupMetadata");
  });

  it("替换美容数据时保持全局字段不变", () => {
    const current = createData();
    const replacement = beautyModuleBackupHandler.extract(createData());
    replacement.inventoryItems[0].name = "备份中的名称";

    const merged = beautyModuleBackupHandler.replace(current, replacement);

    expect(merged.inventoryItems[0].name).toBe("备份中的名称");
    expect(merged.settings).toEqual(current.settings);
    expect(merged.unlockedModules).toEqual(current.unlockedModules);
    expect(merged.backupMetadata).toEqual(current.backupMetadata);
  });

  it("拒绝带悬空引用的美容模块数据", () => {
    const invalid = beautyModuleBackupHandler.extract(createData());
    invalid.projects.push({
      id: "project-1",
      name: "补水",
      standardPriceCents: 10000,
      durationMinutes: 60,
      defaultUsages: [{ inventoryItemId: "missing", quantity: "1" }],
      status: "active",
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      schemaVersion: 1,
    });

    expect(() => beautyModuleBackupHandler.validate(invalid)).toThrow();
  });

  it("按模块标识返回同一模块处理器", () => {
    expect(getBusinessModuleBackupHandler("beauty")).toBe(
      beautyModuleBackupHandler,
    );
  });

  it("拒绝静默丢弃模块备份中的未知字段", () => {
    const extracted = beautyModuleBackupHandler.extract(createData());

    expect(() =>
      beautyModuleBackupHandler.validate({ ...extracted, futureField: true }),
    ).toThrow("未知字段 futureField");
  });
});
