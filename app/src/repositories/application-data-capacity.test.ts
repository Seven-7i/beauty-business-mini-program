import { describe, expect, it } from "vitest";
import type { ApplicationData } from "@/domain/data-schema";
import { filterCustomers } from "@/features/customer/customer-filter";
import type {
  StorageAdapter,
  StorageCapacityInfo,
} from "@/infrastructure/storage/uni-storage-adapter";
import type { ApplicationDataRollbackFileAdapter } from "@/infrastructure/wechat/backup-file-adapter";
import { PRODUCT_STORAGE_TARGET_KB } from "@/services/storage-capacity-service";
import { createApplicationDataRepository } from "./application-data-repository";

const BASE_TIME = new Date("2026-01-01T00:00:00.000Z");
const encoder = new TextEncoder();

function isoAfterMinutes(minutes: number): string {
  return new Date(BASE_TIME.getTime() + minutes * 60_000).toISOString();
}

function serializedBytes(key: string, value: unknown): number {
  return encoder.encode(key).byteLength + encoder.encode(JSON.stringify(value)).byteLength;
}

class MeasuredMemoryStorage implements StorageAdapter {
  readonly values = new Map<string, unknown>();
  quotaBytes = Number.POSITIVE_INFINITY;

  async get<T>(key: string): Promise<T | undefined> {
    return this.values.get(key) as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const hadPrevious = this.values.has(key);
    const previous = this.values.get(key);
    this.values.set(key, value);
    if (
      Number.isFinite(this.quotaBytes) &&
      this.totalBytes() > this.quotaBytes
    ) {
      if (hadPrevious) {
        this.values.set(key, previous);
      } else {
        this.values.delete(key);
      }
      throw new Error("setStorage:fail exceed storage limit");
    }
  }

  async remove(key: string): Promise<void> {
    this.values.delete(key);
  }

  async getCapacityInfo(): Promise<StorageCapacityInfo> {
    return {
      keys: [...this.values.keys()],
      currentSizeKb: this.totalBytes() / 1024,
      limitSizeKb: 10 * 1024,
    };
  }

  totalBytes(): number {
    return [...this.values.entries()].reduce(
      (total, [key, value]) => total + serializedBytes(key, value),
      0,
    );
  }

  largestEntryBytes(): number {
    return Math.max(
      0,
      ...[...this.values.entries()].map(([key, value]) =>
        serializedBytes(key, value),
      ),
    );
  }
}

class MemoryRollbackFiles implements ApplicationDataRollbackFileAdapter {
  private contents?: string;

  async writeApplicationDataRollbackSnapshot(contents: string) {
    this.contents = contents;
    return { name: "rollback.json", path: "memory://rollback.json" };
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
    this.contents = undefined;
  }
}

/** 生成需求文档规定数量且满足当前 schema 引用关系的真实结构数据。 */
function createTargetScaleData(): ApplicationData {
  const inventoryItems = Array.from({ length: 200 }, (_, index) => ({
    id: `inventory-${index}`,
    name: `护理耗材${String(index + 1).padStart(3, "0")}`,
    unit: "瓶",
    unitKind: "discrete" as const,
    currentQuantity: "40",
    note: "阶段四目标规模容量验收使用的真实结构库存备注",
    status: "active" as const,
    createdAt: isoAfterMinutes(index),
    updatedAt: isoAfterMinutes(8_000 + index),
    schemaVersion: 1 as const,
  }));
  const inventoryMovements = inventoryItems.flatMap((item, itemIndex) =>
    Array.from({ length: 40 }, (_, movementIndex) => {
      const occurredAt = isoAfterMinutes(itemIndex * 40 + movementIndex);
      return {
        id: `movement-${itemIndex}-${movementIndex}`,
        inventoryItemId: item.id,
        type: movementIndex === 0 ? ("initial" as const) : ("restock" as const),
        beforeQuantity: String(movementIndex),
        deltaQuantity: "1",
        afterQuantity: String(movementIndex + 1),
        note: `第 ${movementIndex + 1} 次手工补货，保留完整业务说明`,
        occurredAt,
        appointmentDeleted: false,
        createdAt: occurredAt,
        updatedAt: occurredAt,
        schemaVersion: 1 as const,
      };
    }),
  );
  const projects = Array.from({ length: 50 }, (_, index) => ({
    id: `project-${index}`,
    name: `护理项目${String(index + 1).padStart(2, "0")}`,
    standardPriceCents: 8_800 + index * 100,
    durationMinutes: 60 + (index % 4) * 15,
    defaultUsages: [
      { inventoryItemId: inventoryItems[index].id, quantity: "1" },
    ],
    status: "active" as const,
    createdAt: isoAfterMinutes(index),
    updatedAt: isoAfterMinutes(index),
    schemaVersion: 1 as const,
  }));
  const customers = Array.from({ length: 200 }, (_, index) => ({
    id: `customer-${index}`,
    nickname: `顾客${String(index + 1).padStart(3, "0")}`,
    phone: `138${String(index).padStart(8, "0")}`,
    addresses: [
      {
        id: `address-${index}-1`,
        addressText: `上海市测试区容量路 ${index + 1} 号 2 单元 801 室`,
        note: "到达后请电话联系，门禁由顾客本人开启",
      },
      {
        id: `address-${index}-2`,
        addressText: `上海市测试区性能街 ${index + 101} 号`,
      },
    ],
    status: "active" as const,
    createdAt: isoAfterMinutes(index),
    updatedAt: isoAfterMinutes(index),
    schemaVersion: 1 as const,
  }));
  const appointments = Array.from({ length: 2_000 }, (_, index) => {
    const project = projects[index % projects.length];
    const item = inventoryItems[index % inventoryItems.length];
    const scheduledAt = isoAfterMinutes(10_000 + index * 120);
    const cancelledAt = isoAfterMinutes(10_060 + index * 120);
    return {
      id: `appointment-${index}`,
      customerId: customers[index % customers.length].id,
      projectSnapshots: [
        {
          projectId: project.id,
          name: project.name,
          standardPriceCents: project.standardPriceCents,
          durationMinutes: project.durationMinutes,
        },
      ],
      standardAmountCents: project.standardPriceCents,
      estimatedDurationMinutes: project.durationMinutes,
      actualUsages: [
        {
          inventoryItemId: item.id,
          itemNameSnapshot: item.name,
          unitSnapshot: item.unit,
          quantity: "1",
        },
      ],
      scheduledAt,
      serviceAddressSnapshot: {
        addressText: `上海市测试区容量路 ${(index % 200) + 1} 号 2 单元 801 室`,
        note: "预约地址快照不会随顾客地址修改",
      },
      note: "目标规模预约记录，包含真实项目、物品用量和服务地址快照",
      status: "cancelled" as const,
      cancelReason: "顾客临时调整安排，保留业务事实用于历史查询",
      cancelledAt,
      createdAt: scheduledAt,
      updatedAt: cancelledAt,
      schemaVersion: 1 as const,
    };
  });

  return {
    schemaVersion: 1,
    settings: { schemaVersion: 1, defaultModuleId: "beauty" },
    unlockedModules: ["beauty"],
    backupMetadata: {
      schemaVersion: 1,
      firstBusinessDataAt: BASE_TIME.toISOString(),
    },
    inventoryItems,
    inventoryMovements,
    projects,
    customers,
    appointments,
  };
}

describe("阶段 4 目标规模容量与性能", () => {
  it("真实仓储布局不超过 7MB、任一 key 不超过 1MB且常用读取满足目标", async () => {
    const storage = new MeasuredMemoryStorage();
    const repository = createApplicationDataRepository({
      storage,
      rollbackFiles: new MemoryRollbackFiles(),
      appVersion: "1.0.0",
      now: () => BASE_TIME,
    });
    const data = createTargetScaleData();

    expect(data.customers).toHaveLength(200);
    expect(data.projects).toHaveLength(50);
    expect(data.inventoryItems).toHaveLength(200);
    expect(data.appointments).toHaveLength(2_000);
    expect(data.inventoryMovements).toHaveLength(8_000);

    await repository.replaceSnapshot(data);

    const totalSizeKb = storage.totalBytes() / 1024;
    const largestEntrySizeKb = storage.largestEntryBytes() / 1024;
    expect(totalSizeKb).toBeLessThan(PRODUCT_STORAGE_TARGET_KB);
    expect(largestEntrySizeKb).toBeLessThan(1024);

    const readStartedAt = performance.now();
    const persisted = await repository.readSnapshot();
    const readDurationMs = performance.now() - readStartedAt;
    expect(readDurationMs).toBeLessThan(1_000);

    const searchStartedAt = performance.now();
    const found = filterCustomers(persisted.customers, "顾客200", false);
    const searchDurationMs = performance.now() - searchStartedAt;
    expect(found).toHaveLength(1);
    expect(searchDurationMs).toBeLessThan(300);
    console.info(
      `[capacity-benchmark] total=${totalSizeKb.toFixed(2)}KB largest-key=${largestEntrySizeKb.toFixed(2)}KB read=${readDurationMs.toFixed(2)}ms search=${searchDurationMs.toFixed(2)}ms`,
    );
  }, 30_000);

  it("可用配额耗尽时拒绝候选并完整保留原数据", async () => {
    const storage = new MeasuredMemoryStorage();
    const repository = createApplicationDataRepository({
      storage,
      rollbackFiles: new MemoryRollbackFiles(),
      appVersion: "1.0.0",
      now: () => BASE_TIME,
    });
    const source = createTargetScaleData();
    const previous: ApplicationData = {
      ...source,
      inventoryItems: [],
      inventoryMovements: [],
      projects: [],
      customers: [],
      appointments: [],
    };
    await repository.replaceSnapshot(previous);
    storage.quotaBytes = storage.totalBytes() + 1;
    const candidate = structuredClone(previous);
    candidate.customers.push(source.customers[0]);

    await expect(repository.replaceSnapshot(candidate)).rejects.toThrow("storage limit");
    await expect(repository.readSnapshot()).resolves.toEqual(previous);
  }, 30_000);
});
