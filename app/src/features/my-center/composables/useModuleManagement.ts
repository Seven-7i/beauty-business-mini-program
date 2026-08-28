import { readonly, shallowRef } from "vue";
import type { BusinessModuleId } from "@/domain/business-module";
import type { ModuleAuthorizationRepository } from "@/repositories/module-authorization-repository";
import { unlockModule } from "@/services/module-authorization";

export interface UseModuleManagementOptions {
  moduleAuthorization: ModuleAuthorizationRepository;
}

/** 管理本机模块授权列表和新增授权码提交状态。 */
export function useModuleManagement(options: UseModuleManagementOptions) {
  const { moduleAuthorization } = options;
  const unlockedModules = shallowRef<readonly BusinessModuleId[]>([]);
  const loading = shallowRef(false);
  const hasLoaded = shallowRef(false);
  const readError = shallowRef("");
  const moduleCode = shallowRef("");
  const moduleError = shallowRef("");
  const submitting = shallowRef(false);

  async function refresh(): Promise<void> {
    loading.value = true;
    readError.value = "";
    try {
      unlockedModules.value = await moduleAuthorization.getUnlockedModules();
      hasLoaded.value = true;
    } catch {
      readError.value = "本机模块授权读取失败，请稍后重试";
    } finally {
      loading.value = false;
    }
  }

  async function unlockAdditionalModule(): Promise<boolean> {
    moduleError.value = "";
    submitting.value = true;
    try {
      const currentModules = await moduleAuthorization.getUnlockedModules();
      const result = unlockModule(moduleCode.value, currentModules);
      if (result.status === "invalid") {
        moduleError.value = "授权码无效";
        return false;
      }
      if (result.status === "already-unlocked") {
        moduleError.value = "该模块已解锁";
        return false;
      }
      await moduleAuthorization.saveUnlockedModules(result.unlockedModules);
      unlockedModules.value = result.unlockedModules;
      moduleCode.value = "";
      await refresh();
      return true;
    } catch {
      moduleError.value = "模块开启失败，请稍后重试";
      return false;
    } finally {
      submitting.value = false;
    }
  }

  return {
    unlockedModules: readonly(unlockedModules),
    loading: readonly(loading),
    hasLoaded: readonly(hasLoaded),
    readError: readonly(readError),
    moduleCode,
    moduleError: readonly(moduleError),
    submitting: readonly(submitting),
    refresh,
    unlockAdditionalModule,
  };
}
