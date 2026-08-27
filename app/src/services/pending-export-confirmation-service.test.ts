import { describe, expect, it } from "vitest";
import { createPendingExportConfirmationService } from "./pending-export-confirmation-service";

function createFixture(initial?: unknown) {
  const values = new Map<string, unknown>();
  if (initial !== undefined) {
    values.set("bm:backup:pending-export-confirmation", initial);
  }
  const recorded: Array<{ exportedAt: string; fileName: string }> = [];
  let removeFailures = 0;
  let recordFailures = 0;
  const storage = {
    async get<T>(key: string) {
      return values.get(key) as T | undefined;
    },
    async set<T>(key: string, value: T) {
      values.set(key, value);
    },
    async remove(key: string) {
      if (removeFailures > 0) {
        removeFailures -= 1;
        throw new Error("remove failed");
      }
      values.delete(key);
    },
  };
  const repository = {
    async recordSuccessfulExport(exportedAt: string, fileName: string) {
      if (recordFailures > 0) {
        recordFailures -= 1;
        throw new Error("record failed");
      }
      recorded.push({ exportedAt, fileName });
    },
  };
  const service = createPendingExportConfirmationService({
    storage,
    repository,
  });
  return {
    service,
    storage,
    repository,
    values,
    recorded,
    failNextRemove() {
      removeFailures += 1;
    },
    failNextRecord() {
      recordFailures += 1;
    },
  };
}

const pending = {
  createdAt: "2026-08-27T08:00:00.000Z",
  fileName: "庄月空间系统备份_20260827_1600.json",
  scopeKind: "system" as const,
};

describe("待确认导出服务", () => {
  it("跨启动保存并读取尚未确认的发送结果", async () => {
    const { service } = createFixture();

    await service.mark(pending);

    await expect(service.read()).resolves.toMatchObject(pending);
  });

  it("只有确认完整系统备份已发送时才记录最近导出并清除状态", async () => {
    const { service, recorded } = createFixture();
    await service.mark(pending);

    await service.confirmSent(pending);

    expect(recorded).toEqual([
      { exportedAt: pending.createdAt, fileName: pending.fileName },
    ]);
    await expect(service.read()).resolves.toBeUndefined();
  });

  it("模块备份确认发送不更新完整系统导出时间", async () => {
    const { service, recorded } = createFixture();
    const modulePending = { ...pending, scopeKind: "beauty" as const };
    await service.mark(modulePending);

    await service.confirmSent(modulePending);

    expect(recorded).toHaveLength(0);
    await expect(service.read()).resolves.toBeUndefined();
  });

  it("落盘失败但用户当场确认已发送时仍可记录完整系统导出", async () => {
    const { service, recorded } = createFixture();

    await service.confirmSent(pending);

    expect(recorded).toEqual([
      { exportedAt: pending.createdAt, fileName: pending.fileName },
    ]);
  });

  it("初次 tracking 不存在时也先持久化已发送决定，记录失败后可跨启动续作", async () => {
    const fixture = createFixture();
    fixture.failNextRecord();

    await expect(fixture.service.confirmSent(pending)).rejects.toThrow(
      "record failed",
    );
    await expect(fixture.service.read()).resolves.toMatchObject({
      ...pending,
      decision: "sent",
    });

    await fixture.service.confirmSent(pending);
    await expect(fixture.service.read()).resolves.toBeUndefined();
    expect(fixture.recorded).toHaveLength(1);
  });

  it("确认未发送后清除状态，损坏状态也不会阻塞下次启动", async () => {
    const fixture = createFixture();
    await fixture.service.mark(pending);
    await fixture.service.confirmNotSent(pending);
    await expect(fixture.service.read()).resolves.toBeUndefined();

    const corrupted = createFixture({ schemaVersion: 99 });
    await expect(corrupted.service.read()).resolves.toBeUndefined();
    expect(corrupted.values.size).toBe(0);
  });

  it("拒绝新导出覆盖旧待确认记录，也拒绝陈旧弹窗删除当前记录", async () => {
    const { service } = createFixture();
    const newer = {
      ...pending,
      createdAt: "2026-08-27T08:05:00.000Z",
      fileName: "庄月空间系统备份_20260827_1605.json",
    };
    await service.mark(pending);

    await expect(service.mark(newer)).rejects.toThrow("请先处理上次发送结果");
    await expect(service.confirmNotSent(newer)).rejects.toThrow(
      "请先处理上次发送结果",
    );
    await expect(service.read()).resolves.toMatchObject(pending);
  });

  it("跨服务实例串行化并发写入，后一次不能覆盖先占用的待确认槽", async () => {
    const fixture = createFixture();
    const secondService = createPendingExportConfirmationService({
      storage: fixture.storage,
      repository: fixture.repository,
    });
    const newer = {
      ...pending,
      createdAt: "2026-08-27T08:05:00.000Z",
      fileName: "庄月空间系统备份_20260827_1605.json",
    };

    const results = await Promise.allSettled([
      fixture.service.mark(pending),
      secondService.mark(newer),
    ]);

    expect(results.map((result) => result.status)).toEqual([
      "fulfilled",
      "rejected",
    ]);
    await expect(fixture.service.read()).resolves.toMatchObject(pending);
  });

  it("确认旧记录与创建新记录并发时不会误删新记录", async () => {
    const fixture = createFixture();
    const secondService = createPendingExportConfirmationService({
      storage: fixture.storage,
      repository: fixture.repository,
    });
    const newer = {
      ...pending,
      createdAt: "2026-08-27T08:05:00.000Z",
      fileName: "庄月空间系统备份_20260827_1605.json",
    };
    await fixture.service.mark(pending);

    await Promise.all([
      fixture.service.confirmNotSent(pending),
      secondService.mark(newer),
    ]);

    await expect(fixture.service.read()).resolves.toMatchObject(newer);
  });

  it("已发送决定先持久化，后续清理失败时不能改选未发送", async () => {
    const fixture = createFixture();
    await fixture.service.mark(pending);
    fixture.failNextRemove();

    await expect(fixture.service.confirmSent(pending)).rejects.toThrow(
      "remove failed",
    );
    await expect(fixture.service.read()).resolves.toMatchObject({
      ...pending,
      decision: "sent",
    });
    await expect(fixture.service.confirmNotSent(pending)).rejects.toThrow(
      "已确认发送",
    );

    await fixture.service.confirmSent(pending);
    await expect(fixture.service.read()).resolves.toBeUndefined();
  });

  it("兼容迁移尚未包含唯一 ID 的旧待确认状态", async () => {
    const { service, values } = createFixture({
      schemaVersion: 1,
      ...pending,
    });

    const restored = await service.read();

    expect(restored?.confirmationId).toContain(pending.createdAt);
    expect(restored?.decision).toBe("awaiting");
    expect(
      values.get("bm:backup:pending-export-confirmation"),
    ).toMatchObject({ confirmationId: restored?.confirmationId });
  });
});
