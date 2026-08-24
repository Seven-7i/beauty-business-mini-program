import { describe, expect, it } from "vitest";
import type { ApplicationData } from "@/domain/data-schema";
import { useBeautyHomeOverview } from "./useBeautyHomeOverview";

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

describe("美容首页经营数据编排", () => {
  it("读取成功后以当前时刻派生概览", async () => {
    const flow = useBeautyHomeOverview(
      { readSnapshot: async () => emptyData },
      () => new Date(2026, 7, 8, 12, 0, 0, 0),
    );

    await flow.refresh();

    expect(flow.overview.value).toMatchObject({
      monthlyCompletedCount: 0,
      monthlyTransactionAmountCents: 0,
      pendingCount: 0,
      reminders: [],
    });
    expect(flow.errorMessage.value).toBe("");
  });

  it("刷新失败时保留上次成功数据并给出只读错误", async () => {
    let shouldFail = false;
    const flow = useBeautyHomeOverview({
      async readSnapshot() {
        if (shouldFail) {
          throw new Error("storage failed");
        }
        return emptyData;
      },
    });
    await flow.refresh();
    const previous = flow.overview.value;
    shouldFail = true;

    await flow.refresh();

    expect(flow.overview.value).toBe(previous);
    expect(flow.errorMessage.value).toContain("读取失败");
    expect(flow.loading.value).toBe(false);
  });
});
