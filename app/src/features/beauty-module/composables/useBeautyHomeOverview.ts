import { readonly, shallowRef } from "vue";
import type { CustomerV1 } from "@/domain/data-schema";
import type { ApplicationDataRepository } from "@/repositories/application-data-repository";
import {
  deriveBeautyHomeOverview,
  type BeautyHomeOverview,
} from "@/services/statistics-service";

/** 首页只需要读取完整快照，不获得任何业务写入能力。 */
type BeautyHomeRepository = Pick<ApplicationDataRepository, "readSnapshot">;

/** 编排美容首页的派生统计读取；每次页面显示时由组合根主动刷新。 */
export function useBeautyHomeOverview(
  repository: BeautyHomeRepository,
  now: () => Date = () => new Date(),
) {
  const overview = shallowRef<BeautyHomeOverview>();
  const customers = shallowRef<CustomerV1[]>([]);
  const loading = shallowRef(false);
  const errorMessage = shallowRef("");

  async function refresh(): Promise<void> {
    loading.value = true;
    errorMessage.value = "";
    try {
      const data = await repository.readSnapshot();
      overview.value = deriveBeautyHomeOverview(data.appointments, now());
      customers.value = data.customers;
    } catch {
      errorMessage.value = "首页经营数据读取失败，请稍后重试";
    } finally {
      loading.value = false;
    }
  }

  return {
    overview: readonly(overview),
    customers: readonly(customers),
    loading: readonly(loading),
    errorMessage: readonly(errorMessage),
    refresh,
  };
}
