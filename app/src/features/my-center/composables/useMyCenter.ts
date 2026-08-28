import { readonly, shallowRef } from "vue";
import type {
  MyCenterOverview,
  MyCenterService,
} from "@/services/my-center-service";

export interface UseMyCenterOptions {
  /** 汇总“我的”页面只读信息的深模块。 */
  service: MyCenterService;
}

/** 管理“我的”页面的数据摘要读取状态。 */
export function useMyCenter(options: UseMyCenterOptions) {
  const { service } = options;
  const overview = shallowRef<MyCenterOverview>();
  const loading = shallowRef(false);
  const overviewError = shallowRef("");

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

  return {
    overview: readonly(overview),
    loading: readonly(loading),
    overviewError: readonly(overviewError),
    refresh,
  };
}
