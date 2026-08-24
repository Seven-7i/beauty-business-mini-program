import { describe, expect, it } from "vitest";
import type { ApplicationData, CustomerV1 } from "@/domain/data-schema";
import {
  createBackupReminderService,
  type BackupReminderRepository,
} from "./backup-reminder-service";

function createData(createdAt?: string): ApplicationData {
  const customer: CustomerV1 | undefined = createdAt
    ? {
        id: "customer-1",
        nickname: "测试顾客",
        phone: "13800138000",
        addresses: [],
        status: "active",
        createdAt,
        updatedAt: createdAt,
        schemaVersion: 1,
      }
    : undefined;
  return {
    schemaVersion: 1,
    settings: { schemaVersion: 1 },
    unlockedModules: ["beauty"],
    backupMetadata: { schemaVersion: 1 },
    inventoryItems: [],
    inventoryMovements: [],
    projects: [],
    customers: customer ? [customer] : [],
    appointments: [],
  };
}

function createService(data: ApplicationData, now: string) {
  const reminderDates: string[] = [];
  const repository: BackupReminderRepository = {
    async readSnapshot() {
      return data;
    },
    async recordBackupReminderShown(localDate) {
      reminderDates.push(localDate);
      data.backupMetadata.lastReminderDate = localDate;
    },
  };
  return {
    service: createBackupReminderService({
      repository,
      now: () => new Date(now),
    }),
    reminderDates,
  };
}

describe("七天备份提醒服务", () => {
  it("没有业务数据时不提醒", async () => {
    const { service } = createService(createData(), "2026-08-08T10:00:00+08:00");
    await expect(service.claimDueReminder()).resolves.toBe(false);
  });

  it("首次业务数据未满七个本地自然日时不提醒", async () => {
    const { service } = createService(
      createData("2026-08-02T01:00:00.000Z"),
      "2026-08-08T20:00:00+08:00",
    );
    await expect(service.claimDueReminder()).resolves.toBe(false);
  });

  it("满七个本地自然日时记录当天并提醒", async () => {
    const { service, reminderDates } = createService(
      createData("2026-08-01T01:00:00.000Z"),
      "2026-08-08T20:00:00+08:00",
    );
    await expect(service.claimDueReminder()).resolves.toBe(true);
    expect(reminderDates).toEqual(["2026-08-08"]);
  });

  it("当天已经展示过时不重复提醒", async () => {
    const data = createData("2026-07-01T01:00:00.000Z");
    data.backupMetadata.lastReminderDate = "2026-08-08";
    const { service, reminderDates } = createService(
      data,
      "2026-08-08T20:00:00+08:00",
    );
    await expect(service.claimDueReminder()).resolves.toBe(false);
    expect(reminderDates).toEqual([]);
  });

  it("最近成功导出会重新开始七天周期", async () => {
    const data = createData("2026-07-01T01:00:00.000Z");
    data.backupMetadata.lastExportedAt = "2026-08-03T01:00:00.000Z";
    const { service } = createService(data, "2026-08-08T20:00:00+08:00");
    await expect(service.claimDueReminder()).resolves.toBe(false);
  });
});
