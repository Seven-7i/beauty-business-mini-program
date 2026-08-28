import { describe, expect, it, vi } from "vitest";
import type { ModuleAuthorizationRepository } from "@/repositories/module-authorization-repository";
import { useModuleManagement } from "./useModuleManagement";

function createRepository(
  overrides: Partial<ModuleAuthorizationRepository> = {},
): ModuleAuthorizationRepository {
  return {
    getUnlockedModules: vi.fn().mockResolvedValue(["beauty"]),
    saveUnlockedModules: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("模块管理页面状态", () => {
  it("读取本机已解锁模块并保留只读列表", async () => {
    const management = useModuleManagement({
      moduleAuthorization: createRepository(),
    });

    await management.refresh();

    expect(management.unlockedModules.value).toEqual(["beauty"]);
    expect(management.readError.value).toBe("");
    expect(management.loading.value).toBe(false);
  });

  it("重复授权时保留输入并显示明确错误", async () => {
    const repository = createRepository();
    const management = useModuleManagement({ moduleAuthorization: repository });
    management.moduleCode.value = "587960";

    await expect(management.unlockAdditionalModule()).resolves.toBe(false);

    expect(management.moduleCode.value).toBe("587960");
    expect(management.moduleError.value).toBe("该模块已解锁");
    expect(repository.saveUnlockedModules).not.toHaveBeenCalled();
  });

  it("有效授权落盘后立即刷新列表并清空输入", async () => {
    const repository = createRepository({
      getUnlockedModules: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["beauty"]),
    });
    const management = useModuleManagement({ moduleAuthorization: repository });
    management.moduleCode.value = "587960";

    await expect(management.unlockAdditionalModule()).resolves.toBe(true);

    expect(repository.saveUnlockedModules).toHaveBeenCalledWith(["beauty"]);
    expect(management.unlockedModules.value).toEqual(["beauty"]);
    expect(management.moduleCode.value).toBe("");
    expect(management.readError.value).toBe("");
  });

  it("读取失败时保留上一次成功列表并允许重试", async () => {
    const getUnlockedModules = vi
      .fn()
      .mockResolvedValueOnce(["beauty"])
      .mockRejectedValueOnce(new Error("storage failed"));
    const management = useModuleManagement({
      moduleAuthorization: createRepository({ getUnlockedModules }),
    });

    await management.refresh();
    await management.refresh();

    expect(management.unlockedModules.value).toEqual(["beauty"]);
    expect(management.readError.value).toBe("本机模块授权读取失败，请稍后重试");
    expect(management.hasLoaded.value).toBe(true);
  });

  it("读取失败后成功开启模块会读回持久化状态并清除旧错误", async () => {
    const getUnlockedModules = vi
      .fn()
      .mockRejectedValueOnce(new Error("storage failed"))
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(["beauty"]);
    const repository = createRepository({ getUnlockedModules });
    const management = useModuleManagement({ moduleAuthorization: repository });

    await management.refresh();
    management.moduleCode.value = "587960";
    await expect(management.unlockAdditionalModule()).resolves.toBe(true);

    expect(getUnlockedModules).toHaveBeenCalledTimes(3);
    expect(management.unlockedModules.value).toEqual(["beauty"]);
    expect(management.readError.value).toBe("");
    expect(management.hasLoaded.value).toBe(true);
  });
});
