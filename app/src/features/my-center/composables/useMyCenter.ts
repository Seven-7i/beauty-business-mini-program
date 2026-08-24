import { readonly, ref, shallowRef } from "vue";
import type { ModuleAuthorizationRepository } from "@/repositories/module-authorization-repository";
import { unlockModule } from "@/services/module-authorization";
import type {
  MyCenterOverview,
  MyCenterService,
} from "@/services/my-center-service";

export interface UseMyCenterOptions {
  /** 汇总“我的”页面只读信息的深模块。 */
  service: MyCenterService;
  /** 提交新增模块授权所需的窄仓储接口。 */
  moduleAuthorization: ModuleAuthorizationRepository;
}

/** 管理“我的”和模块管理共用的数据摘要及授权码提交状态。 */
export function useMyCenter(options: UseMyCenterOptions) {
  const { service, moduleAuthorization } = options;
  const overview = shallowRef<MyCenterOverview>();
  const loading = ref(false);
  const overviewError = ref("");
  const moduleCode = ref("");
  const moduleError = ref("");
  const submittingModuleCode = ref(false);

  async function refresh(): Promise<void> {
    loading.value = true;
    overviewError.value = "";
    try {
      overview.value = await service.readOverview();
    } catch {
      // “我的”摘要失败不影响已加载业务页面，也不清空上一次成功结果。
      overviewError.value = "本机数据摘要读取失败，请稍后重试";
    } finally {
      loading.value = false;
    }
  }

  async function unlockAdditionalModule(): Promise<boolean> {
    moduleError.value = "";
    submittingModuleCode.value = true;
    try {
      const unlockedModules = await moduleAuthorization.getUnlockedModules();
      const result = unlockModule(moduleCode.value, unlockedModules);
      if (result.status === "invalid") {
        moduleError.value = "授权码无效";
        return false;
      }
      if (result.status === "already-unlocked") {
        moduleError.value = "该模块已解锁";
        return false;
      }
      await moduleAuthorization.saveUnlockedModules(result.unlockedModules);
      moduleCode.value = "";
      await refresh();
      return true;
    } catch {
      moduleError.value = "模块开启失败，请稍后重试";
      return false;
    } finally {
      submittingModuleCode.value = false;
    }
  }

  return {
    overview: readonly(overview),
    loading: readonly(loading),
    overviewError: readonly(overviewError),
    moduleCode,
    moduleError: readonly(moduleError),
    submittingModuleCode: readonly(submittingModuleCode),
    refresh,
    unlockAdditionalModule,
  };
}
