import { describe, expect, it } from "vitest";
import type { ApplicationData } from "@/domain/data-schema";
import { createMyCenterService } from "./my-center-service";

describe("我的页面摘要服务", () => {
  it("只返回模块、导出和容量摘要", async () => {
    const data: ApplicationData = {
      schemaVersion: 1,
      settings: { schemaVersion: 1 },
      unlockedModules: ["beauty"],
      backupMetadata: {
        schemaVersion: 1,
        lastExportedAt: "2026-08-08T08:00:00.000Z",
        lastExportFileName: "美容管家备份_20260808_1600.json",
      },
      inventoryItems: [],
      inventoryMovements: [],
      projects: [],
      customers: [],
      appointments: [],
    };
    const service = createMyCenterService({
      repository: { async readSnapshot() { return data; } },
      storage: {
        async getCapacityInfo() {
          return { keys: ["bm:settings"], currentSizeKb: 128, limitSizeKb: 10240 };
        },
      },
    });

    await expect(service.readOverview()).resolves.toEqual({
      unlockedModules: ["beauty"],
      lastExportedAt: "2026-08-08T08:00:00.000Z",
      lastExportFileName: "美容管家备份_20260808_1600.json",
      storageCapacity: {
        currentSizeKb: 128,
        limitSizeKb: 10240,
        targetSizeKb: 7168,
        keyCount: 1,
        usedPercentOfLimit: 1.25,
        usedPercentOfTarget: 128 / 7168 * 100,
        remainingToTargetKb: 7040,
        status: "within-target",
      },
    });
  });
});
