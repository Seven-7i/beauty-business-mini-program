import { describe, expect, it } from "vitest";
import type { KeyValueStorage } from "@/infrastructure/storage/uni-storage-adapter";
import { createModuleAuthorizationRepository } from "./module-authorization-repository";

function createMemoryStorage(
  initial: Record<string, unknown> = {},
): KeyValueStorage {
  const values = new Map(Object.entries(initial));

  return {
    async get<T>(key: string) {
      return values.get(key) as T | undefined;
    },
    async set<T>(key: string, value: T) {
      values.set(key, value);
    },
    async remove(key: string) {
      values.delete(key);
    },
  };
}

describe("模块授权仓储", () => {
  it("首次使用时没有已解锁模块", async () => {
    const repository = createModuleAuthorizationRepository(createMemoryStorage());

    await expect(repository.getUnlockedModules()).resolves.toEqual([]);
  });

  it("保存后可以读回已解锁的美容模块", async () => {
    const repository = createModuleAuthorizationRepository(createMemoryStorage());

    await repository.saveUnlockedModules(["beauty"]);

    await expect(repository.getUnlockedModules()).resolves.toEqual(["beauty"]);
  });

  it("忽略本地数据中无法识别的模块", async () => {
    const repository = createModuleAuthorizationRepository(
      createMemoryStorage({
        "bm:modules:unlocked": ["beauty", "unknown", 12],
      }),
    );

    await expect(repository.getUnlockedModules()).resolves.toEqual(["beauty"]);
  });
});
