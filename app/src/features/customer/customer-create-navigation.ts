import {
  buildCustomerDetailUrl,
  CUSTOMER_LIST_URL,
} from "./customer-detail-navigation";

/** 统一顾客表单页所需的最小导航运行时。 */
export interface CustomerEditorNavigationRuntime {
  /** 进入新增或编辑顾客表单。 */
  navigateTo(options: { url: string }): unknown;
  /** 展示保存成功反馈。 */
  showToast(options: { title: string; icon: "success" }): unknown;
  /** 返回上一个页面。 */
  navigateBack(): unknown;
  /** 深链根页面保存后重建到对应的列表或详情。 */
  reLaunch(options: { url: string }): unknown;
}

/** 顾客保存完成事件携带的最小业务标识。 */
export interface CustomerSavedPayload {
  /** 编辑模式为被保存顾客标识；新增模式为空，由列表整体刷新。 */
  customerId: string;
}

/** 统一顾客表单与列表、详情页之间的应用级事件接口。 */
export interface CustomerSavedEventRuntime {
  $emit(event: string, payload: CustomerSavedPayload): unknown;
  $on(
    event: string,
    listener: (payload: CustomerSavedPayload) => void,
  ): unknown;
  $off(
    event: string,
    listener: (payload: CustomerSavedPayload) => void,
  ): unknown;
}

/** 统一顾客表单页的稳定页面地址。 */
export const CUSTOMER_EDITOR_URL = "/pages/customer-create/index";

/** 顾客写入仓储完成后通知仍在页面栈中的列表或详情页。 */
export const CUSTOMER_SAVED_EVENT = "customer:saved";

/**
 * 无顾客标识时构造新增地址，有标识时构造编辑地址。
 * 当前由列表、详情页入口和深链完成导航调用；只负责 URL，不读取页面状态。
 */
export function buildCustomerEditorUrl(customerId = ""): string {
  return customerId
    ? `${CUSTOMER_EDITOR_URL}?customerId=${encodeURIComponent(customerId)}`
    : CUSTOMER_EDITOR_URL;
}

/**
 * 从统一表单页参数中读取编辑顾客标识；缺失时进入新增模式。
 * 当前仅由 `pages/customer-create/index` 在 `onLoad` 中调用。
 */
export function readCustomerEditorId(
  query?: Readonly<Record<string, string | undefined>>,
): string {
  return query?.customerId?.trim() ?? "";
}

/**
 * 从顾客列表或详情进入统一顾客表单页。
 * 当前由 `CustomerManagement` 和 `pages/customer-detail/index` 调用。
 */
export function openCustomerEditor(
  customerId = "",
  runtime: Pick<CustomerEditorNavigationRuntime, "navigateTo"> =
    uni as unknown as CustomerEditorNavigationRuntime,
): void {
  runtime.navigateTo({ url: buildCustomerEditorUrl(customerId) });
}

/**
 * 广播已经完成的顾客写入。
 * 当前由 `CustomerEditor` 在仓储写入成功后调用，早于页面返回动作。
 */
export function notifyCustomerSaved(
  customerId = "",
  runtime: Pick<CustomerSavedEventRuntime, "$emit"> =
    uni as unknown as CustomerSavedEventRuntime,
): void {
  runtime.$emit(CUSTOMER_SAVED_EVENT, { customerId });
}

/**
 * 订阅顾客保存完成事件并返回对称的清理函数。
 * 当前由顾客列表和详情路由页调用，页面卸载时必须执行返回函数。
 */
export function subscribeCustomerSaved(
  listener: (payload: CustomerSavedPayload) => void,
  runtime: Pick<CustomerSavedEventRuntime, "$on" | "$off"> =
    uni as unknown as CustomerSavedEventRuntime,
): () => void {
  runtime.$on(CUSTOMER_SAVED_EVENT, listener);
  return () => runtime.$off(CUSTOMER_SAVED_EVENT, listener);
}

/**
 * 创建表单异步完成动作的生命周期门禁。
 * 当前由 `CustomerEditor` 使用，页面卸载后阻止异步保存再次触发导航。
 */
export function createCustomerEditorCompletionGuard() {
  let active = true;
  return {
    isActive: (): boolean => active,
    deactivate(): void {
      active = false;
    },
  };
}

/** 顾客列表路由在重新显示时可刷新的最小公开契约。 */
export interface CustomerListRefreshTarget {
  /** 重新读取顾客与预约快照。 */
  refresh(): Promise<void>;
}

/**
 * 完成顾客保存后的成功反馈与返回动作。
 * 当前由 `CustomerEditor` 调用；普通入口返回原列表或详情，深链入口重建到对应页面。
 */
export function completeCustomerEditorNavigation(
  customerId = "",
  runtime: Pick<
    CustomerEditorNavigationRuntime,
    "showToast" | "navigateBack" | "reLaunch"
  > = uni as unknown as CustomerEditorNavigationRuntime,
  pageCount: number = getCurrentPages().length,
): void {
  runtime.showToast({ title: "顾客资料已保存", icon: "success" });
  if (pageCount > 1) {
    runtime.navigateBack();
    return;
  }
  runtime.reLaunch({
    url: customerId ? buildCustomerDetailUrl(customerId) : CUSTOMER_LIST_URL,
  });
}

/**
 * 顾客列表页面重新显示时刷新已有容器。
 * 当前由 `pages/customer/index` 调用；首次显示且组件尚未挂载时安全跳过。
 */
export async function refreshCustomerListOnShow(
  target?: CustomerListRefreshTarget,
): Promise<void> {
  await target?.refresh();
}
