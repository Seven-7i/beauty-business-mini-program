import { describe, expect, it } from "vitest";
import type {
  StorageAdapter,
  StorageCapacityInfo,
} from "@/infrastructure/storage/uni-storage-adapter";
import { runSegmentedIndexProbe } from "./segmented-index-probe";

function createStorage(): {
  adapter: StorageAdapter;
  values: Map<string, unknown>;
} {
  const values = new Map<string, unknown>();
  const capacityInfo = (): StorageCapacityInfo => ({
    keys: [...values.keys()],
    currentSizeKb: 0,
    limitSizeKb: 10240,
  });

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
        return capacityInfo();
      },
    },
  };
}

describe("分片索引能力探测", () => {
  it("识别异常写入并从事务意图恢复原索引", async () => {
    const storage = createStorage();
    const originalSet = storage.adapter.set.bind(storage.adapter);
    let maximumSerializedBytes = 0;
    storage.adapter.set = async (key, value) => {
      maximumSerializedBytes = Math.max(
        maximumSerializedBytes,
        JSON.stringify(value).length,
      );
      await originalSet(key, value);
    };

    await expect(runSegmentedIndexProbe(storage.adapter)).resolves.toEqual({
      itemCount: 95,
      shardCount: 3,
      recoveredFromInterruptedWrite: true,
    });
    expect(maximumSerializedBytes).toBeLessThan(1024 * 1024);
    expect(storage.values.size).toBe(0);
  });

  it("失败时仍清理隔离探测 key 且不删除业务数据", async () => {
    const storage = createStorage();
    storage.values.set("bm:modules:unlocked", ["beauty"]);
    const originalSet = storage.adapter.set.bind(storage.adapter);
    storage.adapter.set = async (key, value) => {
      if (key.endsWith(":manifest")) {
        throw new Error("模拟 Storage 写入失败");
      }

      await originalSet(key, value);
    };

    await expect(runSegmentedIndexProbe(storage.adapter)).rejects.toThrow(
      "模拟 Storage 写入失败",
    );
    expect(storage.values).toEqual(
      new Map<string, unknown>([["bm:modules:unlocked", ["beauty"]]]),
    );
  });

  it("拒绝指向业务 key 的恶意恢复意图", async () => {
    const storage = createStorage();
    storage.values.set("bm:modules:unlocked", ["beauty"]);
    storage.values.set("bm:stage0:index-probe:intent", {
      kind: "stage0-segmented-index-intent",
      snapshots: [
        {
          key: "bm:modules:unlocked",
          existed: false,
        },
      ],
    });

    await expect(runSegmentedIndexProbe(storage.adapter)).rejects.toThrow(
      "分片索引恢复意图无效",
    );
    expect(storage.values).toEqual(
      new Map<string, unknown>([["bm:modules:unlocked", ["beauty"]]]),
    );
  });

});
