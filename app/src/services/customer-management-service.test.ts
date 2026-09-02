import { describe, expect, it } from "vitest";
import type { ApplicationData, AppointmentV1, CustomerV1 } from "@/domain/data-schema";
import { applyBusinessDataMutation } from "@/repositories/business-data-mutation";
import {
  createCustomerManagementService,
  type CustomerManagementRepository,
} from "./customer-management-service";

const NOW = "2026-08-08T11:00:00.000Z";

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

const customer: CustomerV1 = {
  id: "customer-1",
  nickname: "小雨",
  phone: "13800138000",
  addresses: [],
  status: "active",
  createdAt: NOW,
  updatedAt: NOW,
  schemaVersion: 1,
};

/** 内存仓储保留实际命令复核，覆盖用例与 repository seam 的组合。 */
function createMemoryRepository(initialData: ApplicationData) {
  let data = initialData;
  let mutationCount = 0;
  const repository: CustomerManagementRepository = {
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

describe("顾客管理用例", () => {
  it("按稳定标识读取单个顾客且不存在时返回空值", async () => {
    const memory = createMemoryRepository({
      ...createEmptyData(),
      customers: [customer],
    });
    const service = createCustomerManagementService({
      repository: memory.repository,
    });

    await expect(service.readCustomer(customer.id)).resolves.toEqual(customer);
    await expect(service.readCustomer("missing-customer")).resolves.toBeUndefined();
  });

  it("规范化表单后通过封闭命令新增顾客", async () => {
    const memory = createMemoryRepository(createEmptyData());
    const service = createCustomerManagementService({
      repository: memory.repository,
      now: () => new Date(NOW),
      createId: () => customer.id,
    });

    const created = await service.createCustomer({
      nickname: " 小雨 ",
      phone: " 13800138000 ",
      addresses: [{ id: "address-1", addressText: " 朝阳路 1 号 " }],
    });

    expect(created).toMatchObject({
      id: customer.id,
      nickname: "小雨",
      phone: "13800138000",
      addresses: [{ id: "address-1", addressText: "朝阳路 1 号" }],
      status: "active",
    });
    expect(memory.readData().customers).toEqual([created]);
    expect(memory.readMutationCount()).toBe(1);
  });

  it("无效手机号在提交命令前被拒绝", async () => {
    const memory = createMemoryRepository(createEmptyData());
    const service = createCustomerManagementService({
      repository: memory.repository,
    });

    await expect(
      service.createCustomer({
        nickname: "小雨",
        phone: "10086",
        addresses: [],
      }),
    ).rejects.toThrow("有效的中国大陆");
    expect(memory.readMutationCount()).toBe(0);
  });

  it("编辑顾客时保留稳定标识和创建时间", async () => {
    const memory = createMemoryRepository({
      ...createEmptyData(),
      customers: [customer],
    });
    const service = createCustomerManagementService({
      repository: memory.repository,
      now: () => new Date("2026-08-08T12:00:00.000Z"),
    });

    const updated = await service.updateCustomer({
      customerId: customer.id,
      nickname: "小雨老师",
      phone: customer.phone,
      addresses: [{ id: "address-2", addressText: "幸福路 6 号" }],
    });

    expect(updated.id).toBe(customer.id);
    expect(updated.createdAt).toBe(NOW);
    expect(updated.nickname).toBe("小雨老师");
    expect(memory.readData().customers).toEqual([updated]);
  });

  it("停用后保留资料并可重新启用", async () => {
    const memory = createMemoryRepository({
      ...createEmptyData(),
      customers: [customer],
    });
    const service = createCustomerManagementService({
      repository: memory.repository,
      now: () => new Date(NOW),
    });

    await service.setCustomerStatus(customer.id, "inactive");
    expect(memory.readData().customers[0]?.status).toBe("inactive");
    await service.setCustomerStatus(customer.id, "active");
    expect(memory.readData().customers[0]?.status).toBe("active");
  });

  it("删除未关联顾客，并拒绝删除已有预约的顾客", async () => {
    const memory = createMemoryRepository({
      ...createEmptyData(),
      customers: [customer],
    });
    const service = createCustomerManagementService({
      repository: memory.repository,
    });
    await service.deleteCustomer(customer.id);
    expect(memory.readData().customers).toEqual([]);

    const appointment = {
      id: "appointment-1",
      customerId: customer.id,
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
      actualUsages: [],
      scheduledAt: NOW,
      serviceAddressSnapshot: { addressText: "测试地址" },
      status: "pending",
      createdAt: NOW,
      updatedAt: NOW,
      schemaVersion: 1,
    } as AppointmentV1;
    const referencedMemory = createMemoryRepository({
      ...createEmptyData(),
      customers: [customer],
      appointments: [appointment],
    });
    const referencedService = createCustomerManagementService({
      repository: referencedMemory.repository,
    });

    await expect(referencedService.deleteCustomer(customer.id)).rejects.toThrow(
      "只能停用",
    );
    expect(referencedMemory.readMutationCount()).toBe(0);
  });
});
