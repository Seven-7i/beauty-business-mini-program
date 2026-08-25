import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { ApplicationData } from "@/domain/data-schema";
import { useInventoryManagement } from "@/features/inventory/composables/useInventoryManagement";
import type { InventoryManagementService } from "@/services/inventory-management-service";

function readSource(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const emptyData: ApplicationData = {
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

describe("阶段 4 界面韧性契约", () => {
  it("区分可重试的读取失败与不可盲目重试的业务操作失败", async () => {
    const service = {
      readData: vi.fn().mockRejectedValueOnce(new Error("read failed")),
      createInventoryItem: vi.fn().mockRejectedValueOnce(new Error("名称重复")),
    } as unknown as InventoryManagementService;
    const management = useInventoryManagement({ service });

    await management.refresh();
    expect(management.errorKind.value).toBe("read");

    await management.createItem({
      name: "精华液",
      unit: "瓶",
      unitKind: "discrete",
      initialQuantityInput: "1",
    });
    expect(management.errorKind.value).toBe("operation");
    expect(management.errorMessage.value).toBe("名称重复");
  });

  it("核心数据容器把读取重试交给统一错误组件", () => {
    const containers = [
      "./inventory/components/InventoryManagement.vue",
      "./beauty-project/components/BeautyProjectManagement.vue",
      "./customer/components/CustomerManagement.vue",
      "./appointment/components/AppointmentManagement.vue",
      "./history-cleanup/components/HistoryCleanup.vue",
    ];

    for (const path of containers) {
      const source = readSource(path);
      expect(source).toContain("RecoverableErrorNotice");
      expect(source).toContain(":retryable=\"errorKind === 'read'\"");
      expect(source).toContain('@retry="refresh"');
    }
  });

  it("高风险动态卡片允许长文本换行且操作按钮保持最小触控高度", () => {
    const inventory = readSource("./inventory/components/InventoryItemList.vue");
    const projects = readSource("./beauty-project/components/BeautyProjectList.vue");
    const customers = readSource("./customer/components/CustomerList.vue");
    const appointments = readSource("./appointment/components/AppointmentList.vue");

    for (const source of [inventory, projects, customers, appointments]) {
      expect(source).toContain("overflow-wrap: anywhere");
      expect(source).toMatch(/min-height:\s*68rpx/);
      expect(source).toContain("flex-wrap: wrap");
    }
    expect(inventory).not.toContain(".item-card__name {\n  overflow: hidden");
  });
});
