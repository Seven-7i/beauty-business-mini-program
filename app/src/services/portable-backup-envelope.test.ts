import { describe, expect, it } from "vitest";
import type { ApplicationData } from "@/domain/data-schema";
import { createBackupFileContent } from "./backup-envelope";
import {
  PORTABLE_BACKUP_FORMAT,
  createPortableBackupFileContent,
  preflightPortableBackupFileContent,
} from "./portable-backup-envelope";

const CREATED_AT = "2026-08-09T08:00:00.000Z";

function createData(): ApplicationData {
  return {
    schemaVersion: 1,
    settings: { schemaVersion: 1, defaultModuleId: "beauty" },
    unlockedModules: ["beauty"],
    backupMetadata: { schemaVersion: 1, lastReminderDate: "2026-08-09" },
    inventoryItems: [],
    inventoryMovements: [],
    projects: [],
    customers: [],
    appointments: [],
  };
}

describe("可转发范围化备份 envelope", () => {
  it("完整系统文件声明 system 范围并保留全局数据", () => {
    const contents = createPortableBackupFileContent({
      data: createData(),
      scope: { kind: "system" },
      createdAt: CREATED_AT,
      appVersion: "1.0.0",
    });
    const raw = JSON.parse(contents) as Record<string, unknown>;
    const result = preflightPortableBackupFileContent(contents, "1.0.0");

    expect(raw.format).toBe(PORTABLE_BACKUP_FORMAT);
    expect(raw.scope).toEqual({ kind: "system" });
    expect(result.scope).toEqual({ kind: "system" });
    expect(result.data).toEqual(createData());
  });

  it("美容模块文件不携带全局设置、授权或备份元数据", () => {
    const contents = createPortableBackupFileContent({
      data: createData(),
      scope: { kind: "modules", moduleIds: ["beauty"] },
      createdAt: CREATED_AT,
      appVersion: "1.0.0",
    });
    const raw = JSON.parse(contents) as {
      data: { beauty: Record<string, unknown> };
    };
    const result = preflightPortableBackupFileContent(contents, "1.0.0");

    expect(raw.data.beauty).not.toHaveProperty("settings");
    expect(raw.data.beauty).not.toHaveProperty("unlockedModules");
    expect(raw.data.beauty).not.toHaveProperty("backupMetadata");
    expect(result.scope).toEqual({ kind: "modules", moduleIds: ["beauty"] });
  });

  it("旧版完整备份按完整系统范围兼容预检", () => {
    const legacy = createBackupFileContent({
      data: createData(),
      createdAt: CREATED_AT,
      appVersion: "1.0.0",
    });

    const result = preflightPortableBackupFileContent(legacy, "1.0.0");

    expect(result.scope).toEqual({ kind: "system" });
    expect(result.data).toEqual(createData());
  });

  it("范围被修改但未重新签名时拒绝预检", () => {
    const raw = JSON.parse(
      createPortableBackupFileContent({
        data: createData(),
        scope: { kind: "system" },
        createdAt: CREATED_AT,
        appVersion: "1.0.0",
      }),
    ) as Record<string, unknown>;
    raw.scope = { kind: "modules", moduleIds: ["beauty"] };

    expect(() =>
      preflightPortableBackupFileContent(JSON.stringify(raw), "1.0.0"),
    ).toThrowError(expect.objectContaining({ code: "checksum-mismatch" }));
  });
});
