import { describe, expect, it } from "vitest";
import type { ApplicationData, InventoryItemV1 } from "@/domain/data-schema";
import { applyBusinessDataMutation } from "@/repositories/business-data-mutation";
import {
  createBeautyProjectManagementService,
  type BeautyProjectManagementRepository,
} from "./beauty-project-management-service";

const NOW = "2026-08-08T09:45:00.000Z";

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

const item: InventoryItemV1 = {
  id: "item-1",
  name: "面膜",
  unit: "片",
  unitKind: "discrete",
  currentQuantity: "10",
  status: "active",
  createdAt: NOW,
  updatedAt: NOW,
  schemaVersion: 1,
};

/** 内存实现保留实际命令复核，测试覆盖用例和 repository seam 的组合。 */
function createMemoryRepository(initialData: ApplicationData) {
  let data = initialData;
  let mutationCount = 0;
  const repository: BeautyProjectManagementRepository = {
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

describe("服务项目管理用例", () => {
  it("停用项目重名且默认物品停用后仍可编辑历史资料", async () => {
    const inactiveItem = { ...item, status: "inactive" as const };
    const inactiveProject = {
      id: "project-old",
      name: "补水护理",
      standardPriceCents: 8800,
      durationMinutes: 60,
      defaultUsages: [{ inventoryItemId: inactiveItem.id, quantity: "1" }],
      status: "inactive" as const,
      createdAt: NOW,
      updatedAt: NOW,
      schemaVersion: 1 as const,
    };
    const activeReplacement = {
      ...inactiveProject,
      id: "project-new",
      defaultUsages: [],
      status: "active" as const,
    };
    const memory = createMemoryRepository({
      ...createEmptyData(),
      inventoryItems: [inactiveItem],
      projects: [inactiveProject, activeReplacement],
    });
    const service = createBeautyProjectManagementService({
      repository: memory.repository,
      now: () => new Date(NOW),
    });

    const updated = await service.updateProject({
      projectId: inactiveProject.id,
      name: inactiveProject.name,
      standardPriceInput: "108",
      durationMinutesInput: "75",
      defaultUsages: [
        { inventoryItemId: inactiveItem.id, quantityInput: "1" },
      ],
    });

    expect(updated).toMatchObject({
      id: inactiveProject.id,
      status: "inactive",
      standardPriceCents: 10800,
    });
  });

  it("规范化表单后通过封闭命令新增服务项目", async () => {
    const memory = createMemoryRepository({
      ...createEmptyData(),
      inventoryItems: [item],
    });
    const service = createBeautyProjectManagementService({
      repository: memory.repository,
      now: () => new Date(NOW),
      createId: () => "project-1",
    });

    const project = await service.createProject({
      name: " 补水护理 ",
      standardPriceInput: "88.50",
      durationMinutesInput: "60",
      defaultUsages: [{ inventoryItemId: "item-1", quantityInput: "2" }],
    });

    expect(project).toMatchObject({
      id: "project-1",
      name: "补水护理",
      standardPriceCents: 8850,
      durationMinutes: 60,
      defaultUsages: [{ inventoryItemId: "item-1", quantity: "2" }],
    });
    expect(memory.readData().projects).toEqual([project]);
    expect(memory.readData().backupMetadata.firstBusinessDataAt).toBe(NOW);
    expect(memory.readMutationCount()).toBe(1);
  });

  it("无效默认用量在提交命令前被拒绝", async () => {
    const memory = createMemoryRepository(createEmptyData());
    const service = createBeautyProjectManagementService({
      repository: memory.repository,
    });

    await expect(
      service.createProject({
        name: "补水护理",
        standardPriceInput: "88",
        durationMinutesInput: "60",
        defaultUsages: [{ inventoryItemId: "missing", quantityInput: "1" }],
      }),
    ).rejects.toThrow("不存在或已停用");
    expect(memory.readMutationCount()).toBe(0);
  });

  it("编辑项目时保留稳定标识并排除自身名称冲突", async () => {
    const existing = {
      id: "project-1",
      name: "补水护理",
      standardPriceCents: 8800,
      durationMinutes: 60,
      defaultUsages: [{ inventoryItemId: "item-1", quantity: "1" }],
      status: "active" as const,
      createdAt: NOW,
      updatedAt: NOW,
      schemaVersion: 1 as const,
    };
    const memory = createMemoryRepository({
      ...createEmptyData(),
      inventoryItems: [item],
      projects: [existing],
    });
    const service = createBeautyProjectManagementService({
      repository: memory.repository,
      now: () => new Date(NOW),
    });

    const updated = await service.updateProject({
      projectId: "project-1",
      name: "补水护理",
      standardPriceInput: "108",
      durationMinutesInput: "75",
      defaultUsages: [{ inventoryItemId: "item-1", quantityInput: "2" }],
    });

    expect(updated).toMatchObject({
      id: "project-1",
      standardPriceCents: 10800,
      durationMinutes: 75,
      defaultUsages: [{ inventoryItemId: "item-1", quantity: "2" }],
    });
    expect(memory.readData().projects).toHaveLength(1);
  });

  it("项目停用后保留历史资料并可在规则通过时重新启用", async () => {
    const existing = {
      id: "project-1",
      name: "补水护理",
      standardPriceCents: 8800,
      durationMinutes: 60,
      defaultUsages: [{ inventoryItemId: "item-1", quantity: "1" }],
      status: "active" as const,
      createdAt: NOW,
      updatedAt: NOW,
      schemaVersion: 1 as const,
    };
    const memory = createMemoryRepository({
      ...createEmptyData(),
      inventoryItems: [item],
      projects: [existing],
    });
    const service = createBeautyProjectManagementService({
      repository: memory.repository,
      now: () => new Date(NOW),
    });

    await service.setProjectStatus("project-1", "inactive");
    expect(memory.readData().projects[0]?.status).toBe("inactive");
    await service.setProjectStatus("project-1", "active");
    expect(memory.readData().projects[0]?.status).toBe("active");
  });

  it("彻底删除未进入预约快照的服务项目", async () => {
    const existing = {
      id: "project-1",
      name: "补水护理",
      standardPriceCents: 8800,
      durationMinutes: 60,
      defaultUsages: [],
      status: "inactive" as const,
      createdAt: NOW,
      updatedAt: NOW,
      schemaVersion: 1 as const,
    };
    const memory = createMemoryRepository({
      ...createEmptyData(),
      projects: [existing],
    });
    const service = createBeautyProjectManagementService({
      repository: memory.repository,
    });

    await service.deleteProject("project-1");

    expect(memory.readData().projects).toEqual([]);
  });
});
