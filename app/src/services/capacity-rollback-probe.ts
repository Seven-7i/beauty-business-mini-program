import type {
  StorageAdapter,
  StorageCapacityInfo,
} from "@/infrastructure/storage/uni-storage-adapter";
import type { BackupFileAdapter } from "@/infrastructure/wechat/backup-file-adapter";

const CAPACITY_TARGET_KB = 7 * 1024;
const FILLER_CHUNK_KB = 256;
const MAX_FILLER_KEY_COUNT = Math.ceil(CAPACITY_TARGET_KB / FILLER_CHUNK_KB) + 2;
const PROBE_PREFIX = "bm:stage0:capacity-probe:";
const CLEANUP_MAX_PASSES = 6;
const CLEANUP_STABLE_EMPTY_READS = 2;
const CLEANUP_RETRY_DELAY_MS = 25;
let capacityProbeInProgress = false;

/** 接近容量检查完成后返回给页面的容量摘要。 */
export interface CapacityRollbackProbeResult {
  initialSizeKb: number;
  peakSizeKb: number;
  finalSizeKb: number;
  fillerKeyCount: number;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function combineErrors(
  current: unknown,
  next: unknown,
  operation: string,
): Error {
  if (current === undefined) {
    return next instanceof Error ? next : new Error(String(next));
  }

  return new Error(
    `${errorMessage(current)}；${operation}也失败：${errorMessage(next)}`,
  );
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * 精确删除本轮已知 key，并重复核对容量快照直到连续两轮均无隔离 key。
 * 连续空快照用于兼容部分 Android 真机上 getStorageInfo 的 keys 短暂滞后。
 */
async function removeFillerKeys(
  storage: StorageAdapter,
  knownKeys: readonly string[] = [],
): Promise<StorageCapacityInfo> {
  const pendingKeys = new Set(knownKeys);
  let failure: unknown;
  let stableEmptyReads = 0;
  let latestInfo: StorageCapacityInfo | undefined;

  for (let pass = 0; pass < CLEANUP_MAX_PASSES; pass += 1) {
    let stableInfo: StorageCapacityInfo | undefined;
    const keysToRemove = [...pendingKeys];
    pendingKeys.clear();

    for (const key of keysToRemove) {
      try {
        await storage.remove(key);
      } catch (error) {
        pendingKeys.add(key);
        failure = combineErrors(failure, error, `隔离 key ${key} 清理`);
      }
    }

    try {
      latestInfo = await storage.getCapacityInfo();
      const discoveredKeys = latestInfo.keys.filter((key) =>
        key.startsWith(PROBE_PREFIX),
      );

      if (discoveredKeys.length === 0 && pendingKeys.size === 0) {
        stableEmptyReads += 1;
        if (stableEmptyReads >= CLEANUP_STABLE_EMPTY_READS) {
          stableInfo = latestInfo;
        }
      } else {
        stableEmptyReads = 0;
        for (const key of discoveredKeys) {
          pendingKeys.add(key);
        }
      }
    } catch (error) {
      failure = combineErrors(failure, error, "隔离 key 状态复核");
      stableEmptyReads = 0;
    }

    if (stableInfo !== undefined) {
      if (failure !== undefined) {
        throw failure;
      }

      return stableInfo;
    }

    if (pass < CLEANUP_MAX_PASSES - 1) {
      await wait(CLEANUP_RETRY_DELAY_MS);
    }
  }

  const residualKeys = [
    ...new Set([
      ...pendingKeys,
      ...(latestInfo?.keys.filter((key) => key.startsWith(PROBE_PREFIX)) ?? []),
    ]),
  ];
  const residualError = new Error(
    residualKeys.length > 0
      ? `容量检查结束后仍有隔离探测 key 残留：${residualKeys.join(", ")}`
      : "容量检查结束后无法确认隔离探测 key 已稳定清理",
  );

  if (failure === undefined) {
    throw residualError;
  }

  throw combineErrors(failure, residualError, "隔离 key 最终复核");
}

/**
 * 用隔离 key 将 Storage 逐步填充到约 7MB，并验证回滚文件仍可正常读写。
 * 每个填充 key 控制在 256KB 左右，且 finally 会清理全部探测 key 和本次快照。
 */
export async function runCapacityRollbackProbe(
  storage: StorageAdapter,
  files: BackupFileAdapter,
): Promise<CapacityRollbackProbeResult> {
  if (capacityProbeInProgress) {
    throw new Error("接近容量检查正在运行，请稍后再试");
  }

  capacityProbeInProgress = true;
  let initialSizeKb = 0;
  let peakSizeKb = 0;
  let finalSizeKb = 0;
  let fillerKeyCount = 0;
  const createdFillerKeys: string[] = [];
  let failure: unknown;
  let cleanupInfo: StorageCapacityInfo | undefined;

  try {
    try {
      await removeFillerKeys(storage);
      // 专用文件只保存阶段 0 探测数据，启动新一轮时可安全清理上次中断遗留。
      await files.removeCapacityProbeSnapshot();

      const initialInfo = await storage.getCapacityInfo();
      let currentInfo = initialInfo;
      initialSizeKb = initialInfo.currentSizeKb;

      while (currentInfo.currentSizeKb < CAPACITY_TARGET_KB) {
        if (fillerKeyCount >= MAX_FILLER_KEY_COUNT) {
          throw new Error("隔离数据已达到安全 key 数上限，仍未接近 7MB");
        }

        const remainingKb = CAPACITY_TARGET_KB - currentInfo.currentSizeKb;
        const chunkKb = Math.min(FILLER_CHUNK_KB, Math.max(1, remainingKb));
        const key = `${PROBE_PREFIX}${String(fillerKeyCount).padStart(3, "0")}`;

        await storage.set(key, "x".repeat(chunkKb * 1024));
        // 不依赖 getStorageInfo 的 keys 枚举，保留本轮成功写入的精确清理清单。
        createdFillerKeys.push(key);
        fillerKeyCount += 1;

        const nextInfo = await storage.getCapacityInfo();
        if (nextInfo.currentSizeKb <= currentInfo.currentSizeKb) {
          throw new Error("写入隔离数据后 Storage 容量没有增加");
        }

        currentInfo = nextInfo;
      }

      peakSizeKb = currentInfo.currentSizeKb;
      const snapshotContents = JSON.stringify({
        kind: "stage0-capacity-rollback",
        initialSizeKb,
        peakSizeKb,
      });

      // 填充期间若出现同名文件，说明存在非预期并发或外部写入，禁止覆盖。
      if ((await files.readCapacityProbeSnapshotIfExists()) !== undefined) {
        throw new Error("容量检查快照已被其他操作占用");
      }

      await files.writeCapacityProbeSnapshot(snapshotContents);

      if ((await files.readCapacityProbeSnapshot()) !== snapshotContents) {
        throw new Error("接近 7MB 时回滚文件读写内容不一致");
      }
    } catch (error) {
      failure = error;
    } finally {
      // remove 对缺失文件视为成功，也能清理 write 失败后可能留下的半成品。
      try {
        await files.removeCapacityProbeSnapshot();
      } catch (error) {
        failure = combineErrors(failure, error, "容量检查快照清理");
      }

      try {
        cleanupInfo = await removeFillerKeys(storage, createdFillerKeys);
      } catch (error) {
        failure = combineErrors(failure, error, "隔离容量数据清理");
      }
    }

    if (failure !== undefined) {
      throw failure;
    }

    // 清理函数已经完成连续两轮空快照校验，此处复用其最终容量，避免立即读取旧快照。
    finalSizeKb = cleanupInfo?.currentSizeKb ?? 0;
    return { initialSizeKb, peakSizeKb, finalSizeKb, fillerKeyCount };
  } finally {
    capacityProbeInProgress = false;
  }
}
