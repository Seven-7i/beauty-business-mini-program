import {
  isBusinessModuleId,
  type BusinessModuleId,
} from "@/domain/business-module";
import { runExclusiveStorageOperation } from "@/infrastructure/storage/storage-operation-lock";
import type { KeyValueStorage } from "@/infrastructure/storage/uni-storage-adapter";

const UNLOCKED_MODULES_KEY = "bm:modules:unlocked";

export interface ModuleAuthorizationRepository {
  getUnlockedModules(): Promise<BusinessModuleId[]>;
  saveUnlockedModules(modules: readonly BusinessModuleId[]): Promise<void>;
}

export function createModuleAuthorizationRepository(
  storage: KeyValueStorage,
): ModuleAuthorizationRepository {
  return {
    async getUnlockedModules() {
      return runExclusiveStorageOperation(async () => {
        const stored = await storage.get<unknown>(UNLOCKED_MODULES_KEY);

        if (!Array.isArray(stored)) {
          return [];
        }

        return stored.filter(isBusinessModuleId);
      });
    },
    async saveUnlockedModules(modules) {
      await runExclusiveStorageOperation(() =>
        storage.set(UNLOCKED_MODULES_KEY, [...modules]),
      );
    },
  };
}
