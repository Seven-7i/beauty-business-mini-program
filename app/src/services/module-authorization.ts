import type { BusinessModuleId } from "@/domain/business-module";

export type ModuleUnlockResult =
  | {
      status: "unlocked";
      moduleId: BusinessModuleId;
      unlockedModules: BusinessModuleId[];
    }
  | {
      status: "already-unlocked";
      moduleId: BusinessModuleId;
      unlockedModules: BusinessModuleId[];
    }
  | {
      status: "invalid";
      unlockedModules: BusinessModuleId[];
    };

export function unlockModule(
  code: string,
  unlockedModules: readonly BusinessModuleId[],
): ModuleUnlockResult {
  if (code !== "587960") {
    return {
      status: "invalid",
      unlockedModules: [...unlockedModules],
    };
  }

  if (unlockedModules.includes("beauty")) {
    return {
      status: "already-unlocked",
      moduleId: "beauty",
      unlockedModules: [...unlockedModules],
    };
  }

  return {
    status: "unlocked",
    moduleId: "beauty",
    unlockedModules: [...unlockedModules, "beauty"],
  };
}
