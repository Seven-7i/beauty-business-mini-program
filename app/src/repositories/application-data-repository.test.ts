import { describe, expect, it } from "vitest";
import type { ApplicationData } from "@/domain/data-schema";
import type {
  StorageAdapter,
  StorageCapacityInfo,
} from "@/infrastructure/storage/uni-storage-adapter";
import type { ApplicationDataRollbackFileAdapter } from "@/infrastructure/wechat/backup-file-adapter";
import { createApplicationDataRepository } from "./application-data-repository";
import { createModuleAuthorizationRepository } from "./module-authorization-repository";

const NOW = new Date("2026-08-06T10:00:00.000Z");

class MemoryStorage implements StorageAdapter {
  readonly values = new Map<string, unknown>();
  failSet?: (key: string, value: unknown) => Error | undefined;
  failSetAfterPersist?: (key: string, value: unknown) => Error | undefined;
  failRemove?: (key: string) => Error | undefined;
  capacityKeyFilter?: (key: string) => boolean;
  beforeGet?: (key: string) => Promise<void>;

  constructor(initial: Record<string, unknown> = {}) {
    for (const [key, value] of Object.entries(initial)) {
      this.values.set(key, value);
    }
  }

  async get<T>(key: string): Promise<T | undefined> {
    await this.beforeGet?.(key);
    return this.values.get(key) as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const failure = this.failSet?.(key, value);
    if (failure !== undefined) {
      throw failure;
    }
    this.values.set(key, value);
    const persistedFailure = this.failSetAfterPersist?.(key, value);
    if (persistedFailure !== undefined) {
      throw persistedFailure;
    }
  }

  async remove(key: string): Promise<void> {
    const failure = this.failRemove?.(key);
    if (failure !== undefined) {
      throw failure;
    }
    this.values.delete(key);
  }

  async getCapacityInfo(): Promise<StorageCapacityInfo> {
    return {
      keys: [...this.values.keys()].filter(
        this.capacityKeyFilter ?? (() => true),
      ),
      currentSizeKb: 1,
      limitSizeKb: 10240,
    };
  }
}

class MemoryRollbackFiles {
  contents?: string;
  lastWrittenContents?: string;
  failRemoveCount = 0;
  failWriteAfterPersist = false;

  async writeApplicationDataRollbackSnapshot(contents: string) {
    this.contents = contents;
    this.lastWrittenContents = contents;
    if (this.failWriteAfterPersist) {
      this.failWriteAfterPersist = false;
      throw new Error("writeFile:fail interrupted");
    }
    return {
      name: "bm-recovery-rollback.json",
      path: "memory://bm-recovery-rollback.json",
    };
  }

  async readApplicationDataRollbackSnapshot(): Promise<string> {
    if (this.contents === undefined) {
      throw new Error("rollback not found");
    }
    return this.contents;
  }

  async readApplicationDataRollbackSnapshotIfExists(): Promise<string | undefined> {
    return this.contents;
  }

  async removeApplicationDataRollbackSnapshot(): Promise<void> {
    if (this.failRemoveCount > 0) {
      this.failRemoveCount -= 1;
      throw new Error("unlink:fail busy");
    }
    this.contents = undefined;
  }
}

function createData(id: string, name: string): ApplicationData {
  return {
    schemaVersion: 1,
    settings: { schemaVersion: 1, defaultModuleId: "beauty" },
    unlockedModules: ["beauty"],
    backupMetadata: { schemaVersion: 1 },
    inventoryItems: [
      {
        id,
        name,
        unit: "毫升",
        unitKind: "continuous",
        currentQuantity: "10.5",
        status: "active",
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
        schemaVersion: 1,
      },
    ],
    inventoryMovements: [],
    projects: [],
    customers: [],
    appointments: [],
  };
}

function createRepository(
  storage = new MemoryStorage(),
  files = new MemoryRollbackFiles(),
) {
  const repository = createApplicationDataRepository({
    storage,
    rollbackFiles: files as ApplicationDataRollbackFileAdapter,
    appVersion: "1.0.0",
    now: () => NOW,
  });
  return { repository, storage, files };
}

describe("应用完整数据仓储", () => {
  it("首次接入时汇总阶段 0 的模块授权并迁移为空业务快照", async () => {
    const { repository } = createRepository(
      new MemoryStorage({
        "bm:modules:unlocked": ["beauty", "unknown", 12],
        "bm:settings": { defaultModuleId: "beauty" },
      }),
    );

    await expect(repository.readSnapshot()).resolves.toMatchObject({
      schemaVersion: 1,
      settings: { schemaVersion: 1, defaultModuleId: "beauty" },
      unlockedModules: ["beauty"],
      inventoryItems: [],
      appointments: [],
    });
  });

  it("整体写入固定业务 key 和分片索引后可以汇总读回", async () => {
    const { repository, storage, files } = createRepository();
    const data = createData("item-1", "精华液");

    await repository.replaceSnapshot(data);

    await expect(repository.readSnapshot()).resolves.toEqual(data);
    expect(storage.values.get("bm:meta:schema")).toBe(1);
    expect(storage.values.has("bm:entity:inventory-item:item-1")).toBe(true);
    expect(storage.values.has("bm:index:inventory-item:manifest")).toBe(true);
    expect(storage.values.has("bm:txn:recovery")).toBe(false);
    expect(files.contents).toBeUndefined();
  });

  it("记录成功导出时只更新备份元数据并保留全部业务记录", async () => {
    const { repository, storage, files } = createRepository();
    const data = createData("item-1", "精华液");
    await repository.replaceSnapshot(data);

    await repository.recordSuccessfulExport(
      "2026-08-08T06:30:00.000Z",
      "美容管家备份_20260808_1430.json",
    );

    await expect(repository.readSnapshot()).resolves.toMatchObject({
      inventoryItems: [{ id: "item-1", name: "精华液" }],
      backupMetadata: {
        schemaVersion: 1,
        lastExportedAt: "2026-08-08T06:30:00.000Z",
        lastExportFileName: "美容管家备份_20260808_1430.json",
      },
    });
    expect(storage.values.has("bm:txn:recovery")).toBe(false);
    expect(files.contents).toBeUndefined();
  });

  it("选择美容模块恢复只替换美容数据并保留提交时最新全局字段", async () => {
    const { repository } = createRepository();
    const current = createData("current", "当前物品");
    current.settings = { schemaVersion: 1 };
    current.backupMetadata = {
      schemaVersion: 1,
      lastReminderDate: "2026-08-09",
    };
    await repository.replaceSnapshot(current);
    const backup = createData("backup", "备份物品");

    await repository.replaceSelectedModules({
      beauty: {
        schemaVersion: 1,
        inventoryItems: backup.inventoryItems,
        inventoryMovements: backup.inventoryMovements,
        projects: backup.projects,
        customers: backup.customers,
        appointments: backup.appointments,
      },
    });

    await expect(repository.readSnapshot()).resolves.toMatchObject({
      settings: { schemaVersion: 1 },
      unlockedModules: ["beauty"],
      backupMetadata: {
        schemaVersion: 1,
        lastReminderDate: "2026-08-09",
      },
      inventoryItems: [{ id: "backup", name: "备份物品" }],
    });
  });

  it("选择模块恢复写入失败时原子回滚美容数据和全局字段", async () => {
    const { repository, storage, files } = createRepository();
    const previous = createData("old", "旧物品");
    previous.backupMetadata.lastReminderDate = "2026-08-09";
    await repository.replaceSnapshot(previous);
    const backup = createData("new", "新物品");
    let failed = false;
    storage.failSet = (key) => {
      if (!failed && key === "bm:entity:inventory-item:new") {
        failed = true;
        return new Error("module restore interrupted");
      }
      return undefined;
    };

    await expect(
      repository.replaceSelectedModules({
        beauty: {
          schemaVersion: 1,
          inventoryItems: backup.inventoryItems,
          inventoryMovements: backup.inventoryMovements,
          projects: backup.projects,
          customers: backup.customers,
          appointments: backup.appointments,
        },
      }),
    ).rejects.toThrow("module restore interrupted");

    storage.failSet = undefined;
    await expect(repository.readSnapshot()).resolves.toEqual(previous);
    expect(storage.values.has("bm:entity:inventory-item:new")).toBe(false);
    expect(storage.values.has("bm:txn:recovery")).toBe(false);
    expect(files.contents).toBeUndefined();
  });

  it("记录备份提醒日期时只更新元数据并保留业务记录", async () => {
    const { repository, storage } = createRepository();
    await repository.replaceSnapshot(createData("item-1", "精华液"));

    await repository.recordBackupReminderShown("2026-08-08");

    await expect(repository.readSnapshot()).resolves.toMatchObject({
      inventoryItems: [{ id: "item-1", name: "精华液" }],
      backupMetadata: {
        schemaVersion: 1,
        lastReminderDate: "2026-08-08",
      },
    });
    expect(storage.values.has("bm:txn:recovery")).toBe(false);
  });

  it("业务命令首次写入时初始化全部索引并记录首次业务时间", async () => {
    const { repository } = createRepository();
    const item = createData("item-1", "精华液").inventoryItems[0];

    await repository.applyBusinessMutation({
      kind: "upsert-inventory-item",
      item,
    });

    await expect(repository.readSnapshot()).resolves.toMatchObject({
      inventoryItems: [{ id: "item-1", name: "精华液" }],
      projects: [],
      appointments: [],
      backupMetadata: {
        firstBusinessDataAt: NOW.toISOString(),
      },
    });
  });

  it("保存服务项目时不重写无关库存实体集合", async () => {
    const { repository, storage } = createRepository();
    await repository.replaceSnapshot(createData("item-1", "精华液"));
    storage.failSet = (key) =>
      key.startsWith("bm:entity:inventory-item:")
        ? new Error("不应重写库存实体")
        : undefined;

    await repository.applyBusinessMutation({
      kind: "upsert-beauty-project",
      project: {
        id: "project-1",
        name: "补水护理",
        standardPriceCents: 8800,
        durationMinutes: 60,
        defaultUsages: [],
        status: "active",
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
        schemaVersion: 1,
      },
    });

    await expect(repository.readSnapshot()).resolves.toMatchObject({
      inventoryItems: [{ id: "item-1" }],
      projects: [{ id: "project-1", name: "补水护理" }],
    });
  });

  it("库存物品与变动组合写入失败时原子恢复命令前数据", async () => {
    const { repository, storage } = createRepository();
    const previous = createData("item-1", "精华液");
    await repository.replaceSnapshot(previous);
    const updatedItem = {
      ...previous.inventoryItems[0],
      currentQuantity: "12.5",
      updatedAt: "2026-08-06T11:00:00.000Z",
    };
    let failed = false;
    storage.failSet = (key) => {
      if (!failed && key === "bm:entity:inventory-movement:movement-1") {
        failed = true;
        return new Error("setStorage:fail interrupted");
      }
      return undefined;
    };

    await expect(
      repository.applyBusinessMutation({
        kind: "commit-inventory-adjustment",
        item: updatedItem,
        movement: {
          id: "movement-1",
          inventoryItemId: "item-1",
          type: "restock",
          beforeQuantity: "10.5",
          deltaQuantity: "2",
          afterQuantity: "12.5",
          occurredAt: "2026-08-06T11:00:00.000Z",
          appointmentDeleted: false,
          createdAt: "2026-08-06T11:00:00.000Z",
          updatedAt: "2026-08-06T11:00:00.000Z",
          schemaVersion: 1,
        },
      }),
    ).rejects.toThrow("setStorage:fail interrupted");

    await expect(repository.readSnapshot()).resolves.toEqual(previous);
    expect(storage.values.has("bm:entity:inventory-movement:movement-1")).toBe(
      false,
    );
  });

  it("顾客保存写到一半失败时局部恢复原顾客集合", async () => {
    const { repository, storage } = createRepository();
    const previous = createData("item-1", "精华液");
    await repository.replaceSnapshot(previous);
    let failed = false;
    storage.failSet = (key) => {
      if (!failed && key === "bm:index:customer:manifest") {
        failed = true;
        return new Error("setStorage:fail customer interrupted");
      }
      return undefined;
    };

    await expect(
      repository.applyBusinessMutation({
        kind: "upsert-customer",
        customer: {
          id: "customer-1",
          nickname: "小雨",
          phone: "13800138000",
          addresses: [{ id: "address-1", addressText: "朝阳路 1 号" }],
          status: "active",
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
          schemaVersion: 1,
        },
      }),
    ).rejects.toThrow("customer interrupted");

    await expect(repository.readSnapshot()).resolves.toEqual(previous);
    expect(storage.values.has("bm:entity:customer:customer-1")).toBe(false);
  });

  it("待执行预约保存失败时局部恢复且不产生库存扣减", async () => {
    const { repository, storage } = createRepository();
    const previous = createData("item-1", "精华液");
    previous.projects = [
      {
        id: "project-1",
        name: "补水护理",
        standardPriceCents: 8800,
        durationMinutes: 60,
        defaultUsages: [{ inventoryItemId: "item-1", quantity: "1" }],
        status: "active",
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
        schemaVersion: 1,
      },
    ];
    previous.customers = [
      {
        id: "customer-1",
        nickname: "小雨",
        phone: "13800138000",
        addresses: [],
        status: "active",
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
        schemaVersion: 1,
      },
    ];
    await repository.replaceSnapshot(previous);
    let failed = false;
    storage.failSet = (key) => {
      if (!failed && key === "bm:index:appointment:manifest") {
        failed = true;
        return new Error("setStorage:fail appointment interrupted");
      }
      return undefined;
    };

    await expect(
      repository.applyBusinessMutation({
        kind: "upsert-pending-appointment",
        appointment: {
          id: "appointment-1",
          customerId: "customer-1",
          projectSnapshots: [
            {
              projectId: "project-1",
              name: "补水护理",
              standardPriceCents: 8800,
              durationMinutes: 60,
            },
          ],
          standardAmountCents: 8800,
          estimatedDurationMinutes: 60,
          actualUsages: [
            {
              inventoryItemId: "item-1",
              itemNameSnapshot: "精华液",
              unitSnapshot: "毫升",
              quantity: "1",
            },
          ],
          scheduledAt: NOW.toISOString(),
          serviceAddressSnapshot: { addressText: "建设路 8 号" },
          status: "pending",
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
          schemaVersion: 1,
        },
        expectedReferences: {
          customerUpdatedAt: NOW.toISOString(),
          projects: [{ id: "project-1", updatedAt: NOW.toISOString() }],
          inventoryItems: [{ id: "item-1", updatedAt: NOW.toISOString() }],
        },
      }),
    ).rejects.toThrow("appointment interrupted");

    await expect(repository.readSnapshot()).resolves.toEqual(previous);
    expect(storage.values.has("bm:entity:appointment:appointment-1")).toBe(false);
    expect(
      (await repository.readSnapshot()).inventoryItems[0]?.currentQuantity,
    ).toBe("10.5");
  });

  it("完成预约写到一半失败时恢复预约、库存和预约消耗", async () => {
    const { repository, storage } = createRepository();
    const previous = createData("item-1", "精华液");
    previous.projects = [
      {
        id: "project-1",
        name: "补水护理",
        standardPriceCents: 8800,
        durationMinutes: 60,
        defaultUsages: [{ inventoryItemId: "item-1", quantity: "1.5" }],
        status: "active",
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
        schemaVersion: 1,
      },
    ];
    previous.customers = [
      {
        id: "customer-1",
        nickname: "小雨",
        phone: "13800138000",
        addresses: [],
        status: "active",
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
        schemaVersion: 1,
      },
    ];
    previous.appointments = [
      {
        id: "appointment-1",
        customerId: "customer-1",
        projectSnapshots: [
          {
            projectId: "project-1",
            name: "补水护理",
            standardPriceCents: 8800,
            durationMinutes: 60,
          },
        ],
        standardAmountCents: 8800,
        estimatedDurationMinutes: 60,
        actualUsages: [
          {
            inventoryItemId: "item-1",
            itemNameSnapshot: "精华液",
            unitSnapshot: "毫升",
            quantity: "1.5",
          },
        ],
        scheduledAt: NOW.toISOString(),
        serviceAddressSnapshot: { addressText: "建设路 8 号" },
        status: "pending",
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
        schemaVersion: 1,
      },
    ];
    await repository.replaceSnapshot(previous);
    let failed = false;
    storage.failSet = (key) => {
      if (!failed && key === "bm:entity:appointment:appointment-1") {
        failed = true;
        return new Error("setStorage:fail completion interrupted");
      }
      return undefined;
    };

    await expect(
      repository.applyBusinessMutation({
        kind: "complete-pending-appointment",
        appointmentId: "appointment-1",
        expectedUpdatedAt: NOW.toISOString(),
        actualUsages: previous.appointments[0]!.actualUsages,
        transactionAmountCents: 8200,
        completedAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
        movementIds: [
          {
            inventoryItemId: "item-1",
            movementId: "movement-consumption-1",
          },
        ],
      }),
    ).rejects.toThrow("completion interrupted");

    await expect(repository.readSnapshot()).resolves.toEqual(previous);
    expect(
      storage.values.has(
        "bm:entity:inventory-movement:movement-consumption-1",
      ),
    ).toBe(false);
    expect((await repository.readSnapshot()).inventoryItems[0]?.currentQuantity)
      .toBe("10.5");
  });

  it("删除物品写到一半失败时恢复物品及其手工变动", async () => {
    const { repository, storage } = createRepository();
    const previous = createData("item-1", "精华液");
    previous.inventoryMovements = [
      {
        id: "movement-1",
        inventoryItemId: "item-1",
        type: "initial",
        beforeQuantity: "0",
        deltaQuantity: "10.5",
        afterQuantity: "10.5",
        occurredAt: NOW.toISOString(),
        appointmentDeleted: false,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
        schemaVersion: 1,
      },
    ];
    await repository.replaceSnapshot(previous);
    let failed = false;
    storage.failSet = (key) => {
      if (!failed && key === "bm:index:inventory-movement:manifest") {
        failed = true;
        return new Error("setStorage:fail delete interrupted");
      }
      return undefined;
    };

    await expect(
      repository.applyBusinessMutation({
        kind: "delete-unreferenced-inventory-item",
        inventoryItemId: "item-1",
      }),
    ).rejects.toThrow("delete interrupted");

    await expect(repository.readSnapshot()).resolves.toEqual(previous);
  });

  it("手工变动链重写失败时恢复原库存与原记录", async () => {
    const { repository, storage } = createRepository();
    const previous = createData("item-1", "精华液");
    previous.inventoryMovements = [
      {
        id: "movement-1",
        inventoryItemId: "item-1",
        type: "initial",
        beforeQuantity: "0",
        deltaQuantity: "10.5",
        afterQuantity: "10.5",
        occurredAt: NOW.toISOString(),
        appointmentDeleted: false,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
        schemaVersion: 1,
      },
    ];
    await repository.replaceSnapshot(previous);
    let failed = false;
    storage.failSet = (key) => {
      if (!failed && key === "bm:entity:inventory-movement:movement-1") {
        failed = true;
        return new Error("setStorage:fail rewrite interrupted");
      }
      return undefined;
    };

    await expect(
      repository.applyBusinessMutation({
        kind: "rewrite-manual-inventory-movements",
        item: {
          ...previous.inventoryItems[0],
          currentQuantity: "12",
        },
        movements: [
          {
            ...previous.inventoryMovements[0],
            deltaQuantity: "12",
            afterQuantity: "12",
          },
        ],
        expectedMovements: previous.inventoryMovements.map(
          ({ id, updatedAt }) => ({ id, updatedAt }),
        ),
      }),
    ).rejects.toThrow("rewrite interrupted");

    await expect(repository.readSnapshot()).resolves.toEqual(previous);
  });

  it("业务命令与即时回滚都中断时，下次仓储读取继续恢复原数据", async () => {
    const { repository, storage, files } = createRepository();
    const previous = createData("item-1", "精华液");
    await repository.replaceSnapshot(previous);
    let candidateFailed = false;
    let rollbackFailed = false;
    storage.failSet = (key, value) => {
      if (
        !candidateFailed &&
        key === "bm:entity:inventory-movement:movement-1"
      ) {
        candidateFailed = true;
        return new Error("candidate interrupted");
      }
      if (
        candidateFailed &&
        !rollbackFailed &&
        key === "bm:entity:inventory-item:item-1" &&
        (value as { currentQuantity?: unknown }).currentQuantity === "10.5"
      ) {
        rollbackFailed = true;
        return new Error("rollback interrupted");
      }
      return undefined;
    };

    await expect(
      repository.applyBusinessMutation({
        kind: "commit-inventory-adjustment",
        item: {
          ...previous.inventoryItems[0],
          currentQuantity: "12.5",
          updatedAt: "2026-08-06T11:00:00.000Z",
        },
        movement: {
          id: "movement-1",
          inventoryItemId: "item-1",
          type: "restock",
          beforeQuantity: "10.5",
          deltaQuantity: "2",
          afterQuantity: "12.5",
          occurredAt: "2026-08-06T11:00:00.000Z",
          appointmentDeleted: false,
          createdAt: "2026-08-06T11:00:00.000Z",
          updatedAt: "2026-08-06T11:00:00.000Z",
          schemaVersion: 1,
        },
      }),
    ).rejects.toThrow("rollback interrupted");

    storage.failSet = undefined;
    const resumed = createRepository(storage, files).repository;
    await expect(resumed.readSnapshot()).resolves.toEqual(previous);
    expect(storage.values.has("bm:txn:recovery")).toBe(false);
    expect(files.contents).toBeUndefined();
  });

  it("超过 100 条实体时生成多个固定大小索引分片", async () => {
    const { repository, storage } = createRepository();
    const data = createData("item-0", "物品 0");
    data.inventoryItems = Array.from({ length: 101 }, (_, index) => ({
      ...data.inventoryItems[0],
      id: `item-${index.toString().padStart(3, "0")}`,
      name: `物品 ${index}`,
    }));

    await repository.replaceSnapshot(data);

    expect(storage.values.get("bm:index:inventory-item:manifest")).toMatchObject({
      shardCount: 2,
      itemCount: 101,
    });
    expect(storage.values.has("bm:index:inventory-item:1")).toBe(true);
    await expect(repository.readSnapshot()).resolves.toMatchObject({
      inventoryItems: expect.arrayContaining([
        expect.objectContaining({ id: "item-100" }),
      ]),
    });
  });

  it("候选写入失败时从文件快照恢复原数据", async () => {
    const { repository, storage, files } = createRepository();
    const previous = createData("old", "旧物品");
    await repository.replaceSnapshot(previous);
    let failed = false;
    storage.failSet = (key) => {
      if (!failed && key === "bm:index:inventory-item:manifest") {
        failed = true;
        return new Error("setStorage:fail no space");
      }
      return undefined;
    };

    await expect(
      repository.replaceSnapshot(createData("new", "新物品")),
    ).rejects.toThrow("setStorage:fail no space");

    storage.failSet = undefined;
    await expect(repository.readSnapshot()).resolves.toEqual(previous);
    expect(storage.values.has("bm:entity:inventory-item:new")).toBe(false);
    expect(storage.values.has("bm:txn:recovery")).toBe(false);
    expect(files.contents).toBeUndefined();
  });

  it("回滚文件部分写入即失败时直接清理且不改变业务数据", async () => {
    const { repository, storage, files } = createRepository();
    const previous = createData("old", "旧物品");
    await repository.replaceSnapshot(previous);
    files.failWriteAfterPersist = true;

    await expect(
      repository.replaceSnapshot(createData("new", "新物品")),
    ).rejects.toThrow("writeFile:fail interrupted");

    await expect(repository.readSnapshot()).resolves.toEqual(previous);
    expect(files.contents).toBeUndefined();
  });

  it("残缺孤儿文件首次清理失败时，下次启动无需解析即可继续清理", async () => {
    const { repository, storage, files } = createRepository();
    files.contents = "{partial";
    files.failRemoveCount = 1;

    await expect(repository.recoverInterruptedReplace()).rejects.toThrow(
      "unlink:fail busy",
    );
    await expect(repository.recoverInterruptedReplace()).resolves.toBe(
      "committed-cleanup",
    );
    await expect(repository.readSnapshot()).resolves.toMatchObject({
      schemaVersion: 1,
    });
  });

  it("容量 key 列表延迟时仍按候选 key 清除失败写入残留", async () => {
    const { repository, storage } = createRepository();
    await repository.replaceSnapshot(createData("old", "旧物品"));
    storage.capacityKeyFilter = (key) =>
      key !== "bm:entity:inventory-item:new";
    let failed = false;
    storage.failSet = (key) => {
      if (!failed && key === "bm:index:inventory-item:manifest") {
        failed = true;
        return new Error("setStorage:fail interrupted");
      }
      return undefined;
    };

    await expect(
      repository.replaceSnapshot(createData("new", "新物品")),
    ).rejects.toThrow("setStorage:fail interrupted");

    expect(storage.values.has("bm:entity:inventory-item:new")).toBe(false);
  });

  it("回滚也失败时保留事务和文件，下次启动可以继续恢复", async () => {
    const { repository, storage, files } = createRepository();
    const previous = createData("old", "旧物品");
    await repository.replaceSnapshot(previous);
    let candidateFailed = false;
    storage.failSet = (key) => {
      if (!candidateFailed && key === "bm:index:inventory-item:manifest") {
        candidateFailed = true;
        return new Error("candidate write failed");
      }
      if (candidateFailed && key === "bm:entity:inventory-item:old") {
        return new Error("rollback write failed");
      }
      return undefined;
    };

    await expect(
      repository.replaceSnapshot(createData("new", "新物品")),
    ).rejects.toThrow("恢复原数据也失败");
    expect(storage.values.has("bm:txn:recovery")).toBe(true);
    expect(files.contents).toBeDefined();

    storage.failSet = undefined;
    await expect(repository.recoverInterruptedReplace()).resolves.toBe(
      "rolled-back",
    );
    await expect(repository.readSnapshot()).resolves.toEqual(previous);
    expect(files.contents).toBeUndefined();
  });

  it("候选已提交但临时文件清理失败时保留新数据并在下次清理", async () => {
    const { repository, storage, files } = createRepository();
    await repository.replaceSnapshot(createData("old", "旧物品"));
    files.failRemoveCount = 1;
    const candidate = createData("new", "新物品");

    await expect(repository.replaceSnapshot(candidate)).resolves.toBeUndefined();
    expect(storage.values.get("bm:txn:recovery")).toMatchObject({
      state: "committed",
    });
    expect(files.contents).toBeDefined();

    await expect(repository.recoverInterruptedReplace()).resolves.toBe(
      "committed-cleanup",
    );
    await expect(repository.readSnapshot()).resolves.toEqual(candidate);
  });

  it("提交状态已落盘但回调失败时仍按成功处理，不误回滚候选数据", async () => {
    const { repository, storage } = createRepository();
    await repository.replaceSnapshot(createData("old", "旧物品"));
    storage.failSetAfterPersist = (key, value) => {
      if (
        key === "bm:txn:recovery" &&
        typeof value === "object" &&
        value !== null &&
        (value as { state?: unknown }).state === "committed"
      ) {
        storage.failSetAfterPersist = undefined;
        return new Error("setStorage:fail callback lost");
      }
      return undefined;
    };
    const candidate = createData("new", "新物品");

    await expect(repository.replaceSnapshot(candidate)).resolves.toBeUndefined();

    await expect(repository.readSnapshot()).resolves.toEqual(candidate);
    expect(storage.values.has("bm:txn:recovery")).toBe(false);
  });

  it("起始事务标记写入前失败时拒绝保存，不能把孤儿快照误报为成功", async () => {
    const { repository, storage, files } = createRepository();
    const previous = createData("old", "旧物品");
    await repository.replaceSnapshot(previous);
    let failed = false;
    storage.failSet = (key, value) => {
      if (
        !failed &&
        key === "bm:txn:recovery" &&
        typeof value === "object" &&
        value !== null &&
        (value as { state?: unknown }).state === "writing"
      ) {
        failed = true;
        return new Error("setStorage:fail before persist");
      }
      return undefined;
    };

    await expect(
      repository.replaceSnapshot(createData("new", "新物品")),
    ).rejects.toThrow("setStorage:fail before persist");

    storage.failSet = undefined;
    await expect(repository.readSnapshot()).resolves.toEqual(previous);
    expect(storage.values.has("bm:txn:recovery")).toBe(false);
    expect(files.contents).toBeUndefined();
  });

  it("日常业务命令的回滚文件只包含受影响集合，不序列化无关业务数据", async () => {
    const { repository, storage, files } = createRepository();
    const previous = createData("item-1", "精华液");
    previous.inventoryItems.push({
      ...previous.inventoryItems[0]!,
      id: "item-unrelated",
      name: "同集合但不应重写的物品",
    });
    previous.customers = [
      {
        id: "customer-unrelated",
        nickname: "不应进入库存回滚文件",
        phone: "13800138000",
        addresses: [],
        status: "active",
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
        schemaVersion: 1,
      },
    ];
    await repository.replaceSnapshot(previous);
    storage.failSet = (key) =>
      key === "bm:entity:inventory-item:item-unrelated"
        ? new Error("不应触碰同集合无关实体")
        : undefined;

    await repository.applyBusinessMutation({
      kind: "upsert-inventory-item",
      item: {
        ...previous.inventoryItems[0]!,
        note: "局部资料修改",
      },
      expectedUpdatedAt: previous.inventoryItems[0]!.updatedAt,
    });

    const rollback = JSON.parse(files.lastWrittenContents ?? "{}") as {
      kind?: unknown;
      affectedCollections?: unknown;
      previousEntries?: Array<{ key?: unknown }>;
    };
    expect(rollback.kind).toBe("application-data-mutation-rollback");
    expect(rollback.affectedCollections).toEqual(["inventoryItems"]);
    expect(rollback.previousEntries?.some(
      (entry) => entry.key === "bm:entity:inventory-item:item-1",
    )).toBe(true);
    expect(files.lastWrittenContents).not.toContain("customer-unrelated");
    expect(files.lastWrittenContents).not.toContain("不应进入库存回滚文件");
    expect(files.lastWrittenContents).not.toContain("item-unrelated");
    expect(files.lastWrittenContents).not.toContain("同集合但不应重写的物品");
  });

  it("拒绝回滚快照中指向非业务 key 的候选清单", async () => {
    const { repository, storage, files } = createRepository();
    storage.values.set("unrelated:key", { keep: true });
    storage.values.set("bm:txn:recovery", {
      kind: "application-data-recovery",
      formatVersion: 1,
      runId: "run-1",
      state: "writing",
    });
    files.contents = JSON.stringify({
      kind: "application-data-rollback",
      formatVersion: 1,
      runId: "run-1",
      candidateKeys: ["unrelated:key"],
      backupContents: "{}",
    });

    await expect(repository.recoverInterruptedReplace()).rejects.toThrow(
      "产品恢复回滚快照格式无效",
    );
    expect(storage.values.get("unrelated:key")).toEqual({ keep: true });
  });

  it("同一运行时的多个应用数据仓储实例按顺序访问固定回滚文件", async () => {
    const storage = new MemoryStorage();
    const files = new MemoryRollbackFiles();
    const first = createRepository(storage, files).repository;
    const second = createRepository(storage, files).repository;
    let releaseRead: () => void = () => undefined;
    const readBlocked = new Promise<void>((resolve) => {
      storage.beforeGet = async (key) => {
        if (key !== "bm:txn:recovery") {
          return;
        }
        resolve();
        await new Promise<void>((release) => {
          releaseRead = release;
        });
        storage.beforeGet = undefined;
      };
    });

    const firstRead = first.readSnapshot();
    await readBlocked;

    let secondFinished = false;
    const secondRead = second.readSnapshot().then((snapshot) => {
      secondFinished = true;
      return snapshot;
    });
    await Promise.resolve();
    expect(secondFinished).toBe(false);

    releaseRead();
    await expect(firstRead).resolves.toMatchObject({ schemaVersion: 1 });
    await expect(secondRead).resolves.toMatchObject({ schemaVersion: 1 });
  });

  it("整体恢复与模块授权保存共享队列，后提交的授权不会被恢复覆盖", async () => {
    const storage = new MemoryStorage();
    const files = new MemoryRollbackFiles();
    const applicationData = createRepository(storage, files).repository;
    const moduleAuthorization = createModuleAuthorizationRepository(storage);
    const candidate = createData("item-new", "新物品");
    candidate.unlockedModules = [];
    candidate.settings = { schemaVersion: 1 };
    let releaseReplace: () => void = () => undefined;
    const replaceBlocked = new Promise<void>((resolve) => {
      storage.beforeGet = async (key) => {
        if (key !== "bm:txn:recovery") {
          return;
        }
        resolve();
        await new Promise<void>((release) => {
          releaseReplace = release;
        });
        storage.beforeGet = undefined;
      };
    });

    const replace = applicationData.replaceSnapshot(candidate);
    await replaceBlocked;

    let authorizationSaved = false;
    const saveAuthorization = moduleAuthorization
      .saveUnlockedModules(["beauty"])
      .then(() => {
        authorizationSaved = true;
      });
    await Promise.resolve();
    expect(authorizationSaved).toBe(false);

    releaseReplace();
    await replace;
    await saveAuthorization;
    await expect(applicationData.readSnapshot()).resolves.toMatchObject({
      unlockedModules: ["beauty"],
      settings: { schemaVersion: 1 },
    });
  });
});
