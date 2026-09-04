import { describe, expect, it } from "vitest";
import type {
  ApplicationData,
  AppointmentV1,
  InventoryItemV1,
} from "@/domain/data-schema";
import { applyBusinessDataMutation } from "@/repositories/business-data-mutation";
import {
  createInventoryManagementService,
  type InventoryManagementRepository,
} from "./inventory-management-service";

const NOW = "2026-08-08T09:30:00.000Z";

function createEmptyData(): ApplicationData {
  return {
    schemaVersion: 1,
    settings: { schemaVersion: 1 },
    unlockedModules: ["beauty"],
    backupMetadata: { schemaVersion: 1 },
    inventoryItems: [],
    inventoryMovements: [],
    projects: [],
    customers: [],
    appointments: [],
  };
}

function createItem(
  overrides: Partial<InventoryItemV1> = {},
): InventoryItemV1 {
  return {
    id: "item-1",
    name: "精华液",
    unit: "毫升",
    unitKind: "continuous",
    currentQuantity: "10.5",
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
    schemaVersion: 1,
    ...overrides,
  };
}

/** 内存仓储只实现用例依赖的窄接口，用于验证命令提交边界。 */
function createMemoryRepository(initialData = createEmptyData()) {
  let data = initialData;
  let mutationCount = 0;
  const repository: InventoryManagementRepository = {
    async readSnapshot() {
      return data;
    },
    async applyBusinessMutation(mutation) {
      mutationCount += 1;
      data = applyBusinessDataMutation(data, mutation, NOW);
    },
  };
  return {
    repository,
    readData: () => data,
    readMutationCount: () => mutationCount,
  };
}

function createStableIdGenerator() {
  const sequence = {
    "inventory-item": 0,
    "inventory-movement": 0,
  };
  return (kind: keyof typeof sequence): string => {
    sequence[kind] += 1;
    return `${kind}-${sequence[kind]}`;
  };
}

describe("库存管理用例", () => {
  it("停用物品与新启用物品重名后仍可编辑自身备注", async () => {
    const inactive = createItem({ status: "inactive", note: "旧备注" });
    const activeReplacement = createItem({
      id: "item-2",
      status: "active",
      createdAt: "2026-08-08T09:00:00.000Z",
      updatedAt: "2026-08-08T09:00:00.000Z",
    });
    const memory = createMemoryRepository({
      ...createEmptyData(),
      inventoryItems: [inactive, activeReplacement],
    });
    const service = createInventoryManagementService({
      repository: memory.repository,
      now: () => new Date(NOW),
    });

    const updated = await service.updateInventoryItemProfile({
      inventoryItemId: inactive.id,
      name: inactive.name,
      unit: inactive.unit,
      note: "历史物品新备注",
    });

    expect(updated.note).toBe("历史物品新备注");
    expect(memory.readData().inventoryItems).toHaveLength(2);
  });

  it("新增物品时原子提交物品和首次入库记录", async () => {
    const memory = createMemoryRepository();
    const service = createInventoryManagementService({
      repository: memory.repository,
      now: () => new Date(NOW),
      createId: createStableIdGenerator(),
    });

    const item = await service.createInventoryItem({
      name: " 面膜 ",
      unit: " 片 ",
      unitKind: "discrete",
      initialQuantityInput: "2",
      note: " 首批 ",
    });

    expect(item).toMatchObject({
      id: "inventory-item-1",
      name: "面膜",
      unit: "片",
      currentQuantity: "2",
      note: "首批",
    });
    expect(memory.readData().inventoryMovements).toEqual([
      expect.objectContaining({
        id: "inventory-movement-1",
        inventoryItemId: item.id,
        type: "initial",
        beforeQuantity: "0",
        deltaQuantity: "2",
        afterQuantity: "2",
      }),
    ]);
    expect(memory.readData().backupMetadata.firstBusinessDataAt).toBe(NOW);
    expect(memory.readMutationCount()).toBe(1);
  });

  it("重复名称和单位在提交前被拒绝", async () => {
    const memory = createMemoryRepository({
      ...createEmptyData(),
      inventoryItems: [createItem()],
    });
    const service = createInventoryManagementService({
      repository: memory.repository,
    });

    await expect(
      service.createInventoryItem({
        name: " 精华液 ",
        unit: "毫升",
        unitKind: "continuous",
        initialQuantityInput: "1",
      }),
    ).rejects.toThrow("已存在相同名称和单位");
    expect(memory.readMutationCount()).toBe(0);
  });

  it("补货后同步更新物品数量并追加变动记录", async () => {
    const memory = createMemoryRepository({
      ...createEmptyData(),
      inventoryItems: [createItem()],
    });
    const service = createInventoryManagementService({
      repository: memory.repository,
      now: () => new Date(NOW),
      createId: createStableIdGenerator(),
    });

    const item = await service.adjustInventory({
      inventoryItemId: "item-1",
      kind: "restock",
      quantityInput: "0.25",
      note: " 新到货 ",
    });

    expect(item.currentQuantity).toBe("10.75");
    expect(memory.readData().inventoryMovements).toEqual([
      expect.objectContaining({
        type: "restock",
        deltaQuantity: "0.25",
        afterQuantity: "10.75",
        note: "新到货",
      }),
    ]);
    expect(memory.readMutationCount()).toBe(1);
  });

  it("盘点结果低于待执行预约占用时不提交命令", async () => {
    const appointment: AppointmentV1 = {
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
          quantity: "4",
        },
      ],
      scheduledAt: NOW,
      serviceAddressSnapshot: { addressText: "测试地址" },
      status: "pending",
      createdAt: NOW,
      updatedAt: NOW,
      schemaVersion: 1,
    };
    const memory = createMemoryRepository({
      ...createEmptyData(),
      inventoryItems: [createItem()],
      appointments: [appointment],
    });
    const service = createInventoryManagementService({
      repository: memory.repository,
    });

    await expect(
      service.adjustInventory({
        inventoryItemId: "item-1",
        kind: "stocktake",
        quantityInput: "3.5",
      }),
    ).rejects.toThrow("缺少 0.5毫升");
    expect(memory.readData().inventoryItems[0]?.currentQuantity).toBe("10.5");
    expect(memory.readMutationCount()).toBe(0);
  });

  it("编辑资料不改变库存事实或计量精度", async () => {
    const memory = createMemoryRepository({
      ...createEmptyData(),
      inventoryItems: [createItem({ note: "旧说明" })],
    });
    const service = createInventoryManagementService({
      repository: memory.repository,
      now: () => new Date(NOW),
    });

    const updated = await service.updateInventoryItemProfile({
      inventoryItemId: "item-1",
      name: " 修护精华 ",
      unit: " ml ",
      note: " ",
    });

    expect(updated).toMatchObject({
      name: "修护精华",
      unit: "ml",
      unitKind: "continuous",
      currentQuantity: "10.5",
    });
    expect(updated).not.toHaveProperty("note");
    expect(memory.readData().inventoryMovements).toEqual([]);
  });

  it("停用后可保留历史数据并重新启用", async () => {
    const memory = createMemoryRepository({
      ...createEmptyData(),
      inventoryItems: [createItem()],
    });
    const service = createInventoryManagementService({
      repository: memory.repository,
      now: () => new Date(NOW),
    });

    await service.setInventoryItemStatus("item-1", "inactive");
    expect(memory.readData().inventoryItems[0]?.status).toBe("inactive");
    await service.setInventoryItemStatus("item-1", "active");
    expect(memory.readData().inventoryItems[0]?.status).toBe("active");
    expect(memory.readData().inventoryItems).toHaveLength(1);
  });

  it("物品已被项目引用时拒绝修改计量单位", async () => {
    const memory = createMemoryRepository({
      ...createEmptyData(),
      inventoryItems: [createItem()],
      projects: [
        {
          id: "project-1",
          name: "补水护理",
          standardPriceCents: 8800,
          durationMinutes: 60,
          defaultUsages: [{ inventoryItemId: "item-1", quantity: "1" }],
          status: "active",
          createdAt: NOW,
          updatedAt: NOW,
          schemaVersion: 1,
        },
      ],
    });
    const service = createInventoryManagementService({
      repository: memory.repository,
    });

    await expect(
      service.updateInventoryItemProfile({
        inventoryItemId: "item-1",
        name: "精华液",
        unit: "克",
      }),
    ).rejects.toThrow("不能修改计量单位");
    expect(memory.readMutationCount()).toBe(0);
  });

  it("彻底删除未被引用物品时一并移除手工变动", async () => {
    const memory = createMemoryRepository({
      ...createEmptyData(),
      inventoryItems: [createItem()],
      inventoryMovements: [
        {
          id: "movement-1",
          inventoryItemId: "item-1",
          type: "initial",
          beforeQuantity: "0",
          deltaQuantity: "10.5",
          afterQuantity: "10.5",
          occurredAt: NOW,
          appointmentDeleted: false,
          createdAt: NOW,
          updatedAt: NOW,
          schemaVersion: 1,
        },
      ],
    });
    const service = createInventoryManagementService({
      repository: memory.repository,
    });

    await service.deleteInventoryItem("item-1");

    expect(memory.readData().inventoryItems).toEqual([]);
    expect(memory.readData().inventoryMovements).toEqual([]);
  });

});
