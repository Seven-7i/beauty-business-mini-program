import { readonly, shallowRef } from "vue";
import type { ApplicationDataRepository } from "@/repositories/application-data-repository";
import type { ModuleAuthorizationRepository } from "@/repositories/module-authorization-repository";
import { unlockModule } from "@/services/module-authorization";
import { ensureApplicationDataRecovered } from "@/services/application-startup";

export type LaunchPageState =
  | "loading"
  | "data-error"
  | "locked"
  | "unlocked"
  | "workbench";

/** 启动流程依赖的两个窄仓储接口。 */
export interface UseLaunchFlowOptions {
  moduleAuthorization: ModuleAuthorizationRepository;
  applicationData: Pick<
    ApplicationDataRepository,
    "recoverInterruptedReplace"
  >;
}

export function useLaunchFlow(options: UseLaunchFlowOptions) {
  const { moduleAuthorization, applicationData } = options;
  const pageState = shallowRef<LaunchPageState>("loading");
  const moduleCode = shallowRef("");
  const errorMessage = shallowRef("");
  const submitting = shallowRef(false);

  function setPageTitle(title: string): void {
    uni.setNavigationBarTitle({ title });
  }

  async function initialize(): Promise<void> {
    pageState.value = "loading";
    errorMessage.value = "";
    try {
      const recoveryResult = await ensureApplicationDataRecovered(applicationData);
      const unlockedModules = await moduleAuthorization.getUnlockedModules();
      pageState.value = unlockedModules.length === 1 ? "workbench" : "locked";
      setPageTitle(pageState.value === "workbench" ? "工作台" : "欢迎使用");
      if (recoveryResult === "rolled-back" || recoveryResult === "rolled-back-cleanup") {
        uni.showToast({
          title: "上次数据写入未完成，已恢复原数据",
          icon: "none",
          duration: 3000,
        });
      } else if (recoveryResult === "committed-cleanup") {
        uni.showToast({
          title: "上次数据写入已完成，临时状态已清理",
          icon: "none",
          duration: 3000,
        });
      }
    } catch {
      pageState.value = "data-error";
      errorMessage.value =
        "无法安全读取或恢复本机数据。为避免覆盖原数据，应用已停止进入工作台。";
      setPageTitle("数据保护");
    }
  }

  async function unlock(): Promise<void> {
    errorMessage.value = "";
    submitting.value = true;

    try {
      const unlockedModules = await moduleAuthorization.getUnlockedModules();
      const result = unlockModule(moduleCode.value, unlockedModules);

      if (result.status === "invalid") {
        errorMessage.value = "模块码不正确，请重新输入";
        return;
      }

      await moduleAuthorization.saveUnlockedModules(result.unlockedModules);
      pageState.value = "unlocked";
      setPageTitle("模块已开启");
    } catch {
      errorMessage.value = "模块开启失败，请稍后重试";
    } finally {
      submitting.value = false;
    }
  }

  function enterWorkbench(): void {
    pageState.value = "workbench";
    setPageTitle("工作台");
  }

  function openCapabilityCheck(): void {
    uni.navigateTo({ url: "/pages/capability-check/index" });
  }

  function openBackupRestore(): void {
    uni.navigateTo({ url: "/pages/backup-restore/index" });
  }

  return {
    pageState: readonly(pageState),
    moduleCode,
    errorMessage: readonly(errorMessage),
    submitting: readonly(submitting),
    initialize,
    unlock,
    enterWorkbench,
    openCapabilityCheck,
    openBackupRestore,
  };
}
