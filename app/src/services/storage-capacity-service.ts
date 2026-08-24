import type {
  StorageAdapter,
  StorageCapacityInfo,
} from "@/infrastructure/storage/uni-storage-adapter";

/** 产品为索引更新、迁移和失败回滚预留空间后的建议占用上限。 */
export const PRODUCT_STORAGE_TARGET_KB = 7 * 1024;

export type StorageCapacityStatus = "within-target" | "target-reached";

/** 页面和提醒共用的产品级容量摘要。 */
export interface StorageCapacitySummary {
  currentSizeKb: number;
  limitSizeKb: number;
  targetSizeKb: number;
  keyCount: number;
  usedPercentOfLimit: number;
  usedPercentOfTarget: number;
  remainingToTargetKb: number;
  status: StorageCapacityStatus;
}

export interface StorageCapacityServiceOptions {
  storage: Pick<StorageAdapter, "getCapacityInfo">;
  /** 测试可注入更小阈值，产品默认固定为 7MB。 */
  targetSizeKb?: number;
}

function percentage(value: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.max(0, (value / total) * 100);
}

/** 把微信原始容量信息转换为稳定的产品语义，不修改任何 Storage 数据。 */
export function summarizeStorageCapacity(
  capacity: StorageCapacityInfo,
  targetSizeKb = PRODUCT_STORAGE_TARGET_KB,
): StorageCapacitySummary {
  if (!Number.isFinite(targetSizeKb) || targetSizeKb <= 0) {
    throw new Error("容量目标必须大于零");
  }
  const currentSizeKb = Math.max(0, capacity.currentSizeKb);
  const limitSizeKb = Math.max(0, capacity.limitSizeKb);
  return {
    currentSizeKb,
    limitSizeKb,
    targetSizeKb,
    keyCount: capacity.keys.length,
    usedPercentOfLimit: percentage(currentSizeKb, limitSizeKb),
    usedPercentOfTarget: percentage(currentSizeKb, targetSizeKb),
    remainingToTargetKb: Math.max(0, targetSizeKb - currentSizeKb),
    status:
      currentSizeKb >= targetSizeKb ? "target-reached" : "within-target",
  };
}

export function createStorageCapacityService(
  options: StorageCapacityServiceOptions,
) {
  const { storage, targetSizeKb = PRODUCT_STORAGE_TARGET_KB } = options;

  async function readSummary(): Promise<StorageCapacitySummary> {
    return summarizeStorageCapacity(
      await storage.getCapacityInfo(),
      targetSizeKb,
    );
  }

  return { readSummary };
}

export type StorageCapacityService = ReturnType<
  typeof createStorageCapacityService
>;
