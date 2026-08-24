import type { BackupFileAdapter } from "@/infrastructure/wechat/backup-file-adapter";
import type { KeyValueStorage } from "@/infrastructure/storage/uni-storage-adapter";

const PROBE_KEY = "bm:stage0:recovery-probe";
let rollbackProbeInProgress = false;

interface RollbackProbeSnapshot {
  kind: "stage0-recovery-rollback";
  runId: string;
  hasPreviousValue: boolean;
  previousValue?: unknown;
}

function parseSnapshot(contents: string): RollbackProbeSnapshot {
  const value = JSON.parse(contents) as unknown;

  if (typeof value !== "object" || value === null) {
    throw new Error("回滚快照格式无效");
  }

  const parsed = value as Partial<RollbackProbeSnapshot>;

  if (
    parsed.kind !== "stage0-recovery-rollback" ||
    typeof parsed.runId !== "string" ||
    parsed.runId.length === 0 ||
    typeof parsed.hasPreviousValue !== "boolean" ||
    (parsed.hasPreviousValue &&
      !Object.prototype.hasOwnProperty.call(parsed, "previousValue"))
  ) {
    throw new Error("回滚快照格式无效");
  }

  return parsed as RollbackProbeSnapshot;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function restoreValue(
  storage: KeyValueStorage,
  hasPreviousValue: boolean,
  previousValue: unknown,
): Promise<void> {
  if (hasPreviousValue) {
    await storage.set(PROBE_KEY, previousValue);
    return;
  }

  await storage.remove(PROBE_KEY);
}

function createRunId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

async function recoverInterruptedProbe(
  storage: KeyValueStorage,
  files: Pick<
    BackupFileAdapter,
    | "readRollbackSnapshotIfExists"
    | "removeRollbackSnapshot"
  >,
): Promise<void> {
  const contents = await files.readRollbackSnapshotIfExists();

  if (contents === undefined) {
    return;
  }

  const snapshot = parseSnapshot(contents);
  await restoreValue(
    storage,
    snapshot.hasPreviousValue,
    snapshot.previousValue,
  );

  const restoredValue = await storage.get<unknown>(PROBE_KEY);

  if (!valuesEqual(restoredValue, snapshot.previousValue)) {
    throw new Error("上次回滚检查中断，原探测数据恢复失败");
  }

  await files.removeRollbackSnapshot();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function appendFailure(
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

export async function runRecoveryRollbackProbe(
  storage: KeyValueStorage,
  files: Pick<
    BackupFileAdapter,
    | "writeRollbackSnapshot"
    | "readRollbackSnapshot"
    | "readRollbackSnapshotIfExists"
    | "removeRollbackSnapshot"
  >,
): Promise<void> {
  if (rollbackProbeInProgress) {
    throw new Error("恢复回滚检查正在运行，请稍后再试");
  }

  rollbackProbeInProgress = true;
  try {
    await recoverInterruptedProbe(storage, files);

    const previousValue = await storage.get<unknown>(PROBE_KEY);
    const runId = createRunId();
    const snapshot: RollbackProbeSnapshot = {
      kind: "stage0-recovery-rollback",
      runId,
      hasPreviousValue: previousValue !== undefined,
      previousValue,
    };

    await files.writeRollbackSnapshot(JSON.stringify(snapshot));
    let failure: unknown;
    let probeRestored = false;

    try {
      await storage.set(PROBE_KEY, { state: "candidate" });

      const persistedSnapshot = parseSnapshot(
        await files.readRollbackSnapshot(),
      );

      if (persistedSnapshot.runId !== runId) {
        throw new Error("回滚快照已被其他检查替换");
      }

      await restoreValue(
        storage,
        persistedSnapshot.hasPreviousValue,
        persistedSnapshot.previousValue,
      );

      const restoredValue = await storage.get<unknown>(PROBE_KEY);

      if (!valuesEqual(restoredValue, previousValue)) {
        throw new Error("模拟恢复失败后未能保留原数据");
      }

      probeRestored = true;
    } catch (error) {
      failure = error;
    }

    if (!probeRestored) {
      try {
        await restoreValue(
          storage,
          snapshot.hasPreviousValue,
          snapshot.previousValue,
        );

        const restoredValue = await storage.get<unknown>(PROBE_KEY);

        if (!valuesEqual(restoredValue, previousValue)) {
          throw new Error("兜底恢复后探测数据校验失败");
        }

        probeRestored = true;
      } catch (error) {
        failure = appendFailure(failure, error, "兜底恢复");
      }
    }

    if (probeRestored) {
      try {
        await files.removeRollbackSnapshot();
      } catch (error) {
        failure = appendFailure(failure, error, "临时快照清理");
      }
    }

    if (failure !== undefined) {
      throw failure;
    }
  } finally {
    rollbackProbeInProgress = false;
  }
}
