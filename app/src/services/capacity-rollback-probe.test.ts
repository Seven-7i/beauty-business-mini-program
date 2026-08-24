import { describe, expect, it } from "vitest";
import type { StorageAdapter } from "@/infrastructure/storage/uni-storage-adapter";
import type { BackupFileAdapter } from "@/infrastructure/wechat/backup-file-adapter";
import { runCapacityRollbackProbe } from "./capacity-rollback-probe";

function sizeKb(values: Map<string, unknown>): number {
  return Math.ceil(
    [...values.values()].reduce<number>(
      (total, value) => total + JSON.stringify(value).length,
      0,
    ) / 1024,
  );
}

function createStorage(): {
  adapter: StorageAdapter;
  values: Map<string, unknown>;
} {
  const values = new Map<string, unknown>();

  return {
    values,
    adapter: {
      async get<T>(key: string) {
        return values.get(key) as T | undefined;
      },
      async set(key, value) {
        values.set(key, value);
      },
      async remove(key) {
        values.delete(key);
      },
      async getCapacityInfo() {
        return {
          keys: [...values.keys()],
          currentSizeKb: sizeKb(values),
          limitSizeKb: 10240,
        };
      },
    },
  };
}

function createFiles(): {
  adapter: BackupFileAdapter;
  recovery: { contents?: string };
  capacity: { contents?: string };
} {
  const recovery: { contents?: string } = {};
  const capacity: { contents?: string } = {};

  return {
    recovery,
    capacity,
    adapter: {
      async createJsonFile(name) {
        return { name, path: `wxfile://usr/${name}` };
      },
      async readTextFile() {
        return "{}";
      },
      async chooseJsonFile() {
        return { name: "backup.json", path: "wxfile://tmp/backup.json", sizeBytes: 2 };
      },
      async shareFile() {},
    async removeFile() {},
    async removeGeneratedBackupFiles() {},
      async writeRollbackSnapshot(contents) {
        recovery.contents = contents;
        return { name: "rollback.json", path: "wxfile://usr/rollback.json" };
      },
      async readRollbackSnapshot() {
        return recovery.contents ?? "";
      },
      async readRollbackSnapshotIfExists() {
        return recovery.contents;
      },
      async removeRollbackSnapshot() {
        delete recovery.contents;
      },
      async writeCapacityProbeSnapshot(contents) {
        capacity.contents = contents;
        return {
          name: "capacity-probe.json",
          path: "wxfile://usr/capacity-probe.json",
        };
      },
      async readCapacityProbeSnapshot() {
        return capacity.contents ?? "";
      },
      async readCapacityProbeSnapshotIfExists() {
        return capacity.contents;
      },
      async removeCapacityProbeSnapshot() {
        delete capacity.contents;
      },
    },
  };
}

describe("接近容量时回滚文件能力探测", () => {
  it("填充到约 7MB 后仍能读写回滚文件并清理隔离数据", async () => {
    const storage = createStorage();
    const files = createFiles();
    storage.values.set("bm:modules:unlocked", ["beauty"]);

    const result = await runCapacityRollbackProbe(storage.adapter, files.adapter);

    expect(result.peakSizeKb).toBeGreaterThanOrEqual(7 * 1024);
    expect(result.fillerKeyCount).toBeGreaterThan(0);
    expect(result.finalSizeKb).toBe(sizeKb(storage.values));
    expect(files.capacity.contents).toBeUndefined();
    expect(storage.values).toEqual(
      new Map<string, unknown>([["bm:modules:unlocked", ["beauty"]]]),
    );
  });

  it("产品恢复快照存在时使用独立文件完成容量检查", async () => {
    const storage = createStorage();
    const files = createFiles();
    storage.values.set("bm:modules:unlocked", ["beauty"]);
    files.recovery.contents = '{"kind":"existing-recovery"}';

    await expect(
      runCapacityRollbackProbe(storage.adapter, files.adapter),
    ).resolves.toMatchObject({ peakSizeKb: expect.any(Number) });
    expect(files.recovery.contents).toBe('{"kind":"existing-recovery"}');
    expect(files.capacity.contents).toBeUndefined();
    expect(storage.values).toEqual(
      new Map<string, unknown>([["bm:modules:unlocked", ["beauty"]]]),
    );
  });

  it("启动新检查时清理上次中断遗留的容量专用快照", async () => {
    const storage = createStorage();
    const files = createFiles();
    files.capacity.contents = '{"kind":"stage0-capacity-rollback"}';

    await expect(
      runCapacityRollbackProbe(storage.adapter, files.adapter),
    ).resolves.toMatchObject({ peakSizeKb: expect.any(Number) });
    expect(files.capacity.contents).toBeUndefined();
  });

  it("填充中途失败时清理已经写入的隔离 key", async () => {
    const storage = createStorage();
    const files = createFiles();
    storage.values.set("bm:modules:unlocked", ["beauty"]);
    const originalSet = storage.adapter.set.bind(storage.adapter);
    let fillerWrites = 0;
    storage.adapter.set = async (key, value) => {
      if (key.startsWith("bm:stage0:capacity-probe:")) {
        fillerWrites += 1;
        if (fillerWrites === 3) {
          throw new Error("模拟容量写入失败");
        }
      }

      await originalSet(key, value);
    };

    await expect(
      runCapacityRollbackProbe(storage.adapter, files.adapter),
    ).rejects.toThrow("模拟容量写入失败");
    expect(storage.values).toEqual(
      new Map<string, unknown>([["bm:modules:unlocked", ["beauty"]]]),
    );
  });

  it("回滚快照清理失败时仍清理 Storage 隔离数据", async () => {
    const storage = createStorage();
    const files = createFiles();
    storage.values.set("bm:modules:unlocked", ["beauty"]);
    const originalRemoveCapacityProbeSnapshot =
      files.adapter.removeCapacityProbeSnapshot.bind(files.adapter);
    files.adapter.removeCapacityProbeSnapshot = async () => {
      if (files.capacity.contents !== undefined) {
        throw new Error("模拟回滚快照删除失败");
      }

      await originalRemoveCapacityProbeSnapshot();
    };

    await expect(
      runCapacityRollbackProbe(storage.adapter, files.adapter),
    ).rejects.toThrow("模拟回滚快照删除失败");
    expect(storage.values).toEqual(
      new Map<string, unknown>([["bm:modules:unlocked", ["beauty"]]]),
    );
  });

  it("拒绝同时启动两次容量压力检查", async () => {
    const storage = createStorage();
    const files = createFiles();
    const originalGetCapacityInfo =
      storage.adapter.getCapacityInfo.bind(storage.adapter);
    let releaseFirstRead: (() => void) | undefined;
    const firstReadStarted = new Promise<void>((resolve) => {
      storage.adapter.getCapacityInfo = async () => {
        storage.adapter.getCapacityInfo = originalGetCapacityInfo;
        resolve();
        await new Promise<void>((release) => {
          releaseFirstRead = release;
        });
        return originalGetCapacityInfo();
      };
    });

    const firstRun = runCapacityRollbackProbe(storage.adapter, files.adapter);
    await firstReadStarted;

    await expect(
      runCapacityRollbackProbe(storage.adapter, files.adapter),
    ).rejects.toThrow("接近容量检查正在运行");
    releaseFirstRead?.();
    await expect(firstRun).resolves.toMatchObject({
      peakSizeKb: expect.any(Number),
    });
  });

  it("容量增长异常缓慢时在安全 key 数上限停止并清理", async () => {
    const storage = createStorage();
    const files = createFiles();
    storage.values.set("bm:modules:unlocked", ["beauty"]);
    const originalGetCapacityInfo =
      storage.adapter.getCapacityInfo.bind(storage.adapter);
    let reportedSizeKb = 0;
    storage.adapter.getCapacityInfo = async () => {
      const info = await originalGetCapacityInfo();
      return { ...info, currentSizeKb: reportedSizeKb++ };
    };

    await expect(
      runCapacityRollbackProbe(storage.adapter, files.adapter),
    ).rejects.toThrow("安全 key 数上限");
    expect(storage.values).toEqual(
      new Map<string, unknown>([["bm:modules:unlocked", ["beauty"]]]),
    );
  });

  it("容量信息的 key 列表延迟一轮时仍清理本轮全部隔离 key", async () => {
    const storage = createStorage();
    const files = createFiles();
    storage.values.set("bm:modules:unlocked", ["beauty"]);
    const originalGetCapacityInfo =
      storage.adapter.getCapacityInfo.bind(storage.adapter);
    let previousKeys: readonly string[] = [];

    // 模拟部分 Android 真机：容量数值已更新，但 keys 仍返回上一次调用的快照。
    storage.adapter.getCapacityInfo = async () => {
      const currentInfo = await originalGetCapacityInfo();
      const delayedInfo = { ...currentInfo, keys: previousKeys };
      previousKeys = currentInfo.keys;
      return delayedInfo;
    };

    await expect(
      runCapacityRollbackProbe(storage.adapter, files.adapter),
    ).resolves.toMatchObject({ peakSizeKb: expect.any(Number) });
    expect(storage.values).toEqual(
      new Map<string, unknown>([["bm:modules:unlocked", ["beauty"]]]),
    );
  });
});
