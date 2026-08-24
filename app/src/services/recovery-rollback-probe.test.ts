import { describe, expect, it, vi } from "vitest";
import type { KeyValueStorage } from "@/infrastructure/storage/uni-storage-adapter";
import { runRecoveryRollbackProbe } from "./recovery-rollback-probe";

const PROBE_KEY = "bm:stage0:recovery-probe";

function createMemoryStorage(initial?: unknown) {
  const values = new Map<string, unknown>();

  if (initial !== undefined) {
    values.set(PROBE_KEY, initial);
  }

  const storage: KeyValueStorage = {
    async get<T>(key: string) {
      return values.get(key) as T | undefined;
    },
    async set(key, nextValue) {
      values.set(key, nextValue);
    },
    async remove(key) {
      values.delete(key);
    },
  };

  return {
    storage,
    read: (key = PROBE_KEY) => values.get(key),
  };
}

describe("恢复失败回滚能力检查", () => {
  it("探测结束后保留原有数据", async () => {
    const memory = createMemoryStorage({ owner: "current-data" });
    let snapshot = "";
    const files = {
      async readRollbackSnapshotIfExists() {
        return undefined;
      },
      async writeRollbackSnapshot(contents: string) {
        snapshot = contents;
        return { name: "rollback.json", path: "wxfile://usr/rollback.json" };
      },
      async readRollbackSnapshot() {
        return snapshot;
      },
      removeRollbackSnapshot: vi.fn(async () => undefined),
    };

    await runRecoveryRollbackProbe(memory.storage, files);

    expect(memory.read()).toEqual({ owner: "current-data" });
    expect(files.removeRollbackSnapshot).toHaveBeenCalledOnce();
  });

  it("原先没有探测 key 时不会留下测试数据", async () => {
    const memory = createMemoryStorage();
    let snapshot = "";
    const files = {
      async readRollbackSnapshotIfExists() {
        return undefined;
      },
      async writeRollbackSnapshot(contents: string) {
        snapshot = contents;
        return { name: "rollback.json", path: "wxfile://usr/rollback.json" };
      },
      async readRollbackSnapshot() {
        return snapshot;
      },
      async removeRollbackSnapshot() {},
    };

    await runRecoveryRollbackProbe(memory.storage, files);

    expect(memory.read()).toBeUndefined();
  });

  it("回滚快照写入失败时不触碰本地数据", async () => {
    const memory = createMemoryStorage({ owner: "current-data" });
    const set = vi.spyOn(memory.storage, "set");
    const files = {
      async readRollbackSnapshotIfExists() {
        return undefined;
      },
      async writeRollbackSnapshot() {
        throw new Error("writeFile:fail no space");
      },
      async readRollbackSnapshot() {
        throw new Error("本测试不应读取快照");
      },
      async removeRollbackSnapshot() {},
    };

    await expect(runRecoveryRollbackProbe(memory.storage, files)).rejects.toThrow(
      "writeFile:fail no space",
    );
    expect(set).not.toHaveBeenCalled();
    expect(memory.read()).toEqual({ owner: "current-data" });
  });

  it("回滚快照损坏时仍用原值兜底恢复探测 key", async () => {
    const memory = createMemoryStorage({ owner: "current-data" });
    const removeRollbackSnapshot = vi.fn(async () => undefined);
    const files = {
      async readRollbackSnapshotIfExists() {
        return undefined;
      },
      async writeRollbackSnapshot() {
        return { name: "rollback.json", path: "wxfile://usr/rollback.json" };
      },
      async readRollbackSnapshot() {
        return '{"unexpected":true}';
      },
      removeRollbackSnapshot,
    };

    await expect(runRecoveryRollbackProbe(memory.storage, files)).rejects.toThrow(
      "回滚快照格式无效",
    );
    expect(memory.read()).toEqual({ owner: "current-data" });
    expect(removeRollbackSnapshot).toHaveBeenCalledOnce();
  });

  it("兜底恢复失败时保留临时快照供下次恢复", async () => {
    let setCount = 0;
    const storage: KeyValueStorage = {
      async get<T>() {
        return { owner: "current-data" } as T;
      },
      async set() {
        setCount += 1;

        if (setCount > 1) {
          throw new Error("setStorage:fail no space");
        }
      },
      async remove() {},
    };
    const removeRollbackSnapshot = vi.fn(async () => undefined);
    const files = {
      async readRollbackSnapshotIfExists() {
        return undefined;
      },
      async writeRollbackSnapshot() {
        return { name: "rollback.json", path: "wxfile://usr/rollback.json" };
      },
      async readRollbackSnapshot() {
        return '{"unexpected":true}';
      },
      removeRollbackSnapshot,
    };

    await expect(runRecoveryRollbackProbe(storage, files)).rejects.toThrow(
      "兜底恢复也失败：setStorage:fail no space",
    );
    expect(removeRollbackSnapshot).not.toHaveBeenCalled();
  });

  it("同一时间只允许一个回滚检查操作", async () => {
    const memory = createMemoryStorage({ owner: "current-data" });
    let releaseWrite: (() => void) | undefined;
    const writeStarted = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    let snapshot = "";
    const files = {
      async readRollbackSnapshotIfExists() {
        return undefined;
      },
      async writeRollbackSnapshot(contents: string) {
        await writeStarted;
        snapshot = contents;
        return { name: "rollback.json", path: "wxfile://usr/rollback.json" };
      },
      async readRollbackSnapshot() {
        return snapshot;
      },
      async removeRollbackSnapshot() {},
    };

    const firstProbe = runRecoveryRollbackProbe(memory.storage, files);
    await expect(runRecoveryRollbackProbe(memory.storage, files)).rejects.toThrow(
      "恢复回滚检查正在运行",
    );
    releaseWrite?.();
    await expect(firstProbe).resolves.toBeUndefined();
  });

  it("新一轮检查前恢复上次中断留下的快照", async () => {
    const memory = createMemoryStorage({ state: "candidate-from-old-run" });
    await memory.storage.set("bm:modules:unlocked", ["beauty"]);
    let snapshot = JSON.stringify({
      kind: "stage0-recovery-rollback",
      runId: "old-run",
      hasPreviousValue: true,
      previousValue: { owner: "current-data" },
    });
    let hasOrphanSnapshot = true;
    const removeRollbackSnapshot = vi.fn(async () => {
      hasOrphanSnapshot = false;
    });
    const files = {
      async readRollbackSnapshotIfExists() {
        return hasOrphanSnapshot ? snapshot : undefined;
      },
      async writeRollbackSnapshot(contents: string) {
        snapshot = contents;
        hasOrphanSnapshot = true;
        return { name: "rollback.json", path: "wxfile://usr/rollback.json" };
      },
      async readRollbackSnapshot() {
        return snapshot;
      },
      removeRollbackSnapshot,
    };

    await runRecoveryRollbackProbe(memory.storage, files);

    expect(memory.read()).toEqual({ owner: "current-data" });
    expect(memory.read("bm:modules:unlocked")).toEqual(["beauty"]);
    expect(removeRollbackSnapshot).toHaveBeenCalledTimes(2);
  });
});
