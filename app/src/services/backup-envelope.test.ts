import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ApplicationData } from "@/domain/data-schema";
import {
  BACKUP_FORMAT,
  BackupEnvelopeError,
  createBackupFileContent,
  preflightBackupFileContent,
} from "./backup-envelope";

const CREATED_AT = "2026-08-06T08:30:00.000Z";

function createData(): ApplicationData {
  return {
    schemaVersion: 1,
    settings: { schemaVersion: 1, defaultModuleId: "beauty" },
    unlockedModules: ["beauty"],
    backupMetadata: { schemaVersion: 1 },
    inventoryItems: [
      {
        id: "item-1",
        name: "精华液🧴",
        unit: "毫升",
        unitKind: "continuous",
        currentQuantity: "30.5",
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

/** 测试侧独立实现规范化 JSON，用 Node crypto 验证生产 SHA-256 结果。 */
function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalStringify(record[key])}`)
    .join(",")}}`;
}

function checksum(value: unknown): string {
  return createHash("sha256").update(canonicalStringify(value)).digest("hex");
}

function parseGeneratedEnvelope(): Record<string, unknown> {
  return JSON.parse(
    createBackupFileContent({
      data: createData(),
      createdAt: CREATED_AT,
      appVersion: "1.0.0",
    }),
  ) as Record<string, unknown>;
}

function resign(envelope: Record<string, unknown>): void {
  const { payloadChecksum: _oldChecksum, ...payload } = envelope;
  envelope.payloadChecksum = checksum(payload);
}

function expectBackupError(
  action: () => unknown,
  expected: { code: BackupEnvelopeError["code"]; path: string },
): void {
  try {
    action();
    throw new Error("预期备份预检失败，但实际成功");
  } catch (error) {
    expect(error).toBeInstanceOf(BackupEnvelopeError);
    expect(error).toMatchObject(expected);
  }
}

describe("产品级备份 envelope", () => {
  it("生成带格式版本、应用版本和标准 SHA-256 的可读 JSON", () => {
    const envelope = parseGeneratedEnvelope();
    const { payloadChecksum, ...payload } = envelope;

    expect(envelope).toMatchObject({
      format: BACKUP_FORMAT,
      formatVersion: 1,
      createdAt: CREATED_AT,
      appVersion: "1.0.0",
    });
    expect(payloadChecksum).toBe(checksum(payload));
  });

  it("预检有效备份并返回当前 schema 数据与确认摘要", () => {
    const contents = createBackupFileContent({
      data: createData(),
      createdAt: CREATED_AT,
      appVersion: "1.0.0",
    });

    const result = preflightBackupFileContent(contents, "1.0.0");

    expect(result.createdAt).toBe(CREATED_AT);
    expect(result.appVersion).toBe("1.0.0");
    expect(result.data).toEqual(createData());
    expect(result.summary).toEqual({
      inventoryItemCount: 1,
      inventoryMovementCount: 0,
      projectCount: 0,
      customerCount: 0,
      appointmentCount: 0,
      hasBusinessData: true,
    });
  });

  it("文件重新排版或调整属性顺序后仍能通过完整性校验", () => {
    const original = parseGeneratedEnvelope();
    const reordered = {
      data: original.data,
      payloadChecksum: original.payloadChecksum,
      appVersion: original.appVersion,
      createdAt: original.createdAt,
      formatVersion: original.formatVersion,
      format: original.format,
    };

    expect(
      preflightBackupFileContent(JSON.stringify(reordered), "1.0.0"),
    ).toMatchObject({ appVersion: "1.0.0" });
  });

  it("业务数据被修改但 checksum 未更新时拒绝恢复", () => {
    const envelope = parseGeneratedEnvelope();
    const data = envelope.data as ApplicationData;
    data.inventoryItems[0].name = "被篡改的名称";

    expectBackupError(
      () => preflightBackupFileContent(JSON.stringify(envelope), "1.0.0"),
      { code: "checksum-mismatch", path: "$.payloadChecksum" },
    );
  });

  it("无效 JSON 和未知 envelope 字段不会进入数据迁移", () => {
    expectBackupError(() => preflightBackupFileContent("{broken", "1.0.0"), {
      code: "invalid-json",
      path: "$",
    });

    const envelope = parseGeneratedEnvelope();
    envelope.futureField = "不能静默丢弃";
    expectBackupError(
      () => preflightBackupFileContent(JSON.stringify(envelope), "1.0.0"),
      { code: "invalid-envelope", path: "$.futureField" },
    );
  });

  it("未来 envelope 版本提示升级，不误报为文件损坏", () => {
    const envelope = parseGeneratedEnvelope();
    envelope.formatVersion = 2;

    expectBackupError(
      () => preflightBackupFileContent(JSON.stringify(envelope), "1.0.0"),
      { code: "future-format-version", path: "$.formatVersion" },
    );
  });

  it("完整性有效但数据 schema 来自未来版本时提示升级", () => {
    const envelope = parseGeneratedEnvelope();
    envelope.data = { schemaVersion: 2 };
    resign(envelope);

    expectBackupError(
      () => preflightBackupFileContent(JSON.stringify(envelope), "1.0.0"),
      { code: "future-data-version", path: "$.data.schemaVersion" },
    );
  });

  it("完整性有效的阶段 0 数据会迁移为当前 v1 空业务快照", () => {
    const envelope = parseGeneratedEnvelope();
    envelope.data = {
      unlockedModules: ["beauty"],
      defaultModuleId: "beauty",
    };
    resign(envelope);

    const result = preflightBackupFileContent(
      JSON.stringify(envelope),
      "1.0.0",
    );

    expect(result.data).toMatchObject({
      schemaVersion: 1,
      settings: { schemaVersion: 1, defaultModuleId: "beauty" },
      unlockedModules: ["beauty"],
    });
    expect(result.summary.hasBusinessData).toBe(false);
  });

  it("较新应用版本生成的备份提示先升级", () => {
    const envelope = parseGeneratedEnvelope();
    envelope.appVersion = "1.1.0";
    resign(envelope);

    expectBackupError(
      () => preflightBackupFileContent(JSON.stringify(envelope), "1.0.0"),
      { code: "future-app-version", path: "$.appVersion" },
    );
  });

  it("严格拒绝不存在的日历日期", () => {
    expectBackupError(
      () =>
        createBackupFileContent({
          data: createData(),
          createdAt: "2026-02-30T08:30:00.000Z",
          appVersion: "1.0.0",
        }),
      { code: "invalid-envelope", path: "$.createdAt" },
    );
  });

  it("缺少 data 必填字段时按无效 envelope 拒绝", () => {
    const envelope = parseGeneratedEnvelope();
    delete envelope.data;

    expectBackupError(
      () => preflightBackupFileContent(JSON.stringify(envelope), "1.0.0"),
      { code: "invalid-envelope", path: "$.data" },
    );
  });

  it("超出最大嵌套深度时返回稳定错误而不是栈溢出", () => {
    const envelope = parseGeneratedEnvelope();
    let nested: unknown = "leaf";
    for (let depth = 0; depth < 70; depth += 1) {
      nested = { child: nested };
    }
    envelope.data = nested;
    envelope.payloadChecksum = "0".repeat(64);

    expectBackupError(
      () => preflightBackupFileContent(JSON.stringify(envelope), "1.0.0"),
      { code: "backup-too-complex", path: expect.any(String) as string },
    );
  });

  it("生成端拒绝写出预检端无法恢复的超大备份", () => {
    const data = createData();
    data.inventoryItems[0].note = "x".repeat(16 * 1024 * 1024);

    expectBackupError(
      () =>
        createBackupFileContent({
          data,
          createdAt: CREATED_AT,
          appVersion: "1.0.0",
        }),
      { code: "backup-too-large", path: "$" },
    );
  });
});
