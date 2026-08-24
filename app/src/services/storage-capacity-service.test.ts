import { describe, expect, it } from "vitest";
import {
  PRODUCT_STORAGE_TARGET_KB,
  createStorageCapacityService,
  summarizeStorageCapacity,
} from "./storage-capacity-service";

describe("产品级 Storage 容量摘要", () => {
  it("低于 7MB 时返回剩余空间且不进入提醒状态", () => {
    expect(
      summarizeStorageCapacity({
        keys: ["bm:settings", "bm:customer:1"],
        currentSizeKb: PRODUCT_STORAGE_TARGET_KB - 1,
        limitSizeKb: 10 * 1024,
      }),
    ).toMatchObject({
      keyCount: 2,
      remainingToTargetKb: 1,
      status: "within-target",
    });
  });

  it("达到 7MB 时进入提醒状态但不修改任何数据", async () => {
    let readCount = 0;
    const service = createStorageCapacityService({
      storage: {
        async getCapacityInfo() {
          readCount += 1;
          return {
            keys: ["bm:settings"],
            currentSizeKb: PRODUCT_STORAGE_TARGET_KB,
            limitSizeKb: 10 * 1024,
          };
        },
      },
    });

    await expect(service.readSummary()).resolves.toMatchObject({
      currentSizeKb: PRODUCT_STORAGE_TARGET_KB,
      remainingToTargetKb: 0,
      status: "target-reached",
    });
    expect(readCount).toBe(1);
  });
});
