import { afterEach, describe, expect, it, vi } from "vitest";
import type { ModuleAuthorizationRepository } from "@/repositories/module-authorization-repository";
import { useLaunchFlow } from "./useLaunchFlow";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubUni() {
  const titles: string[] = [];
  const toasts: string[] = [];
  const routes: string[] = [];
  vi.stubGlobal("uni", {
    setNavigationBarTitle({ title }: { title: string }) {
      titles.push(title);
    },
    showToast({ title }: { title: string }) {
      toasts.push(title);
    },
    navigateTo({ url }: { url: string }) {
      routes.push(url);
    },
  });
  return { titles, toasts, routes };
}

function createModuleAuthorization(
  getUnlockedModules: () => Promise<readonly "beauty"[]> = async () => [
    "beauty",
  ],
): ModuleAuthorizationRepository {
  return {
    async getUnlockedModules() {
      return [...(await getUnlockedModules())];
    },
    async saveUnlockedModules() {},
  };
}

describe("应用启动流程", () => {
  it("先处理中断恢复，再返回唯一已解锁模块作为直接进入目标", async () => {
    stubUni();
    const calls: string[] = [];
    const flow = useLaunchFlow({
      applicationData: {
        async recoverInterruptedReplace() {
          calls.push("recover");
          return "none";
        },
      },
      moduleAuthorization: createModuleAuthorization(async () => {
        calls.push("authorization");
        return ["beauty"];
      }),
    });

    const initialModule = await flow.initialize();

    expect(calls).toEqual(["recover", "authorization"]);
    expect(flow.pageState.value).toBe("workbench");
    expect(initialModule).toBe("beauty");
  });

  it("发现未提交数据写入时回滚原数据并向用户报告", async () => {
    const ui = stubUni();
    const flow = useLaunchFlow({
      applicationData: {
        async recoverInterruptedReplace() {
          return "rolled-back";
        },
      },
      moduleAuthorization: createModuleAuthorization(),
    });

    const initialModule = await flow.initialize();

    expect(ui.toasts).toContain("上次数据写入未完成，已恢复原数据");
    expect(flow.pageState.value).toBe("workbench");
    expect(initialModule).toBe("beauty");
  });

  it("中断恢复失败时进入只读保护，不继续读取授权", async () => {
    const ui = stubUni();
    let authorizationRead = false;
    const flow = useLaunchFlow({
      applicationData: {
        async recoverInterruptedReplace() {
          throw new Error("rollback file damaged");
        },
      },
      moduleAuthorization: createModuleAuthorization(async () => {
        authorizationRead = true;
        return ["beauty"];
      }),
    });

    await flow.initialize();

    expect(authorizationRead).toBe(false);
    expect(flow.pageState.value).toBe("data-error");
    expect(flow.errorMessage.value).toContain("避免覆盖原数据");
    expect(ui.titles.at(-1)).toBe("数据保护");
  });

  it("未解锁模块时停留激活页且不返回直接进入目标", async () => {
    stubUni();
    const flow = useLaunchFlow({
      applicationData: {
        async recoverInterruptedReplace() {
          return "none";
        },
      },
      moduleAuthorization: createModuleAuthorization(async () => []),
    });

    const initialModule = await flow.initialize();

    expect(flow.pageState.value).toBe("locked");
    expect(initialModule).toBeUndefined();
  });

  it("激活页和工作台共用产品备份恢复入口", () => {
    const ui = stubUni();
    const flow = useLaunchFlow({
      applicationData: {
        async recoverInterruptedReplace() {
          return "none";
        },
      },
      moduleAuthorization: createModuleAuthorization(),
    });

    flow.openBackupRestore();

    expect(ui.routes).toEqual(["/pages/backup-restore/index"]);
  });
});
