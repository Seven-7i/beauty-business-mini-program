import { describe, expect, it, vi } from "vitest";
import type {
  ApplicationData,
  CustomerV1,
  PendingAppointmentV1,
} from "@/domain/data-schema";
import type { CustomerManagementService } from "@/services/customer-management-service";
import { useCustomerDetail } from "./useCustomerManagement";

const customer: CustomerV1 = {
  id: "customer-1",
  nickname: "张女士",
  phone: "13800138000",
  addresses: [],
  status: "active",
  createdAt: "2026-08-01T08:00:00.000Z",
  updatedAt: "2026-08-01T08:00:00.000Z",
  schemaVersion: 1,
};

/** 创建顾客详情测试所需的最小待执行预约。 */
function appointment(
  id: string,
  customerId: string,
  scheduledAt: string,
): PendingAppointmentV1 {
  return {
    id,
    customerId,
    projectSnapshots: [
      {
        projectId: "project-1",
        name: "补水护理",
        standardPriceCents: 52000,
        durationMinutes: 90,
      },
    ],
    standardAmountCents: 52000,
    estimatedDurationMinutes: 90,
    actualUsages: [],
    scheduledAt,
    serviceAddressSnapshot: { addressText: "建设路 8 号" },
    status: "pending",
    createdAt: scheduledAt,
    updatedAt: scheduledAt,
    schemaVersion: 1,
  };
}

/** 创建可替换快照的详情服务桩。 */
function createService(data: ApplicationData) {
  return {
    readData: vi.fn().mockResolvedValue(data),
    updateCustomer: vi.fn().mockResolvedValue(customer),
    setCustomerStatus: vi.fn().mockResolvedValue(customer),
    deleteCustomer: vi.fn().mockResolvedValue(undefined),
  } as unknown as CustomerManagementService;
}

const baseData: ApplicationData = {
  schemaVersion: 1,
  settings: { schemaVersion: 1 },
  unlockedModules: ["beauty"],
  backupMetadata: { schemaVersion: 1 },
  inventoryItems: [],
  inventoryMovements: [],
  projects: [],
  customers: [customer],
  appointments: [
    appointment("older", customer.id, "2026-08-20T08:00:00.000Z"),
    appointment("other", "customer-2", "2026-08-30T08:00:00.000Z"),
    appointment("newer", customer.id, "2026-08-28T08:00:00.000Z"),
  ],
};

describe("useCustomerDetail", () => {
  it("只暴露当前顾客预约并按计划时间倒序", async () => {
    const detail = useCustomerDetail(createService(baseData), customer.id);

    expect(await detail.refresh()).toBe(true);
    expect(detail.customer.value?.nickname).toBe("张女士");
    expect(detail.appointments.value.map(({ id }) => id)).toEqual([
      "newer",
      "older",
    ]);
  });

  it("顾客不存在时清空旧资料并展示不可误写的缺失状态", async () => {
    const detail = useCustomerDetail(
      createService({ ...baseData, customers: [] }),
      customer.id,
    );

    expect(await detail.refresh()).toBe(false);
    expect(detail.customer.value).toBeUndefined();
    expect(detail.errorKind.value).toBe("missing");
  });

  it("彻底删除成功后不再读取已删除顾客", async () => {
    const service = createService(baseData);
    const detail = useCustomerDetail(service, customer.id);

    expect(await detail.deleteCustomer()).toBe(true);
    expect(service.deleteCustomer).toHaveBeenCalledWith(customer.id);
    expect(service.readData).not.toHaveBeenCalled();
  });

  it("读取失败时保留旧快照并暴露可重试的读取错误", async () => {
    const service = createService(baseData);
    const detail = useCustomerDetail(service, customer.id);

    expect(await detail.refresh()).toBe(true);
    vi.mocked(service.readData).mockRejectedValueOnce(new Error("storage"));

    expect(await detail.refresh()).toBe(false);
    expect(detail.customer.value?.id).toBe(customer.id);
    expect(detail.errorKind.value).toBe("read");
    expect(detail.errorMessage.value).toContain("读取失败");
  });

  it("状态操作成功后刷新详情，删除失败则保留当前页面", async () => {
    const service = createService(baseData);
    const detail = useCustomerDetail(service, customer.id);

    expect(await detail.setCustomerStatus("inactive")).toBe(true);
    expect(service.setCustomerStatus).toHaveBeenCalledWith(
      customer.id,
      "inactive",
    );
    expect(service.readData).toHaveBeenCalledOnce();

    vi.mocked(service.deleteCustomer).mockRejectedValueOnce(
      new Error("顾客已有预约记录，只能停用"),
    );
    expect(await detail.deleteCustomer()).toBe(false);
    expect(detail.errorKind.value).toBe("operation");
    expect(detail.errorMessage.value).toContain("只能停用");
  });
});
