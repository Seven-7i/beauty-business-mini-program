/** 顾客详情导航所需的最小微信运行时。 */
export interface CustomerDetailNavigationRuntime {
  /** 进入指定顾客的独立详情页。 */
  navigateTo(options: { url: string }): unknown;
  /** 删除完成后返回顾客列表。 */
  navigateBack(): unknown;
  /** 无上一页时直接回到顾客列表，保证深链入口可恢复。 */
  reLaunch(options: { url: string }): unknown;
  /** 展示删除成功反馈。 */
  showToast(options: { title: string; icon: "none" }): unknown;
}

/** 顾客列表的稳定页面地址。 */
export const CUSTOMER_LIST_URL = "/pages/customer/index";

/** 构造只携带稳定顾客标识的详情页地址。 */
export function buildCustomerDetailUrl(customerId: string): string {
  return `/pages/customer-detail/index?customerId=${encodeURIComponent(customerId)}`;
}

/**
 * 从 uni-app 页面参数读取顾客标识。
 * 缺失或全空参数返回空字符串，由路由页展示可恢复错误而不是读取错误顾客。
 */
export function readCustomerDetailId(
  query?: Readonly<Record<string, string | undefined>>,
): string {
  return query?.customerId?.trim() ?? "";
}

/** 从顾客列表进入独立详情页。 */
export function openCustomerDetail(
  customerId: string,
  runtime: Pick<CustomerDetailNavigationRuntime, "navigateTo"> =
    uni as unknown as CustomerDetailNavigationRuntime,
): void {
  runtime.navigateTo({ url: buildCustomerDetailUrl(customerId) });
}

/** 删除顾客后提示结果并返回顾客列表。 */
export function completeCustomerDetailDeletion(
  runtime: Pick<
    CustomerDetailNavigationRuntime,
    "navigateBack" | "reLaunch" | "showToast"
  > = uni as unknown as CustomerDetailNavigationRuntime,
  pageCount: number = getCurrentPages().length,
): void {
  runtime.showToast({ title: "顾客已删除", icon: "none" });
  returnToCustomerList(pageCount, runtime);
}

/**
 * 返回顾客列表；普通列表入口保留原导航栈，深链入口重建到顾客列表。
 */
export function returnToCustomerList(
  pageCount: number = getCurrentPages().length,
  runtime: Pick<
    CustomerDetailNavigationRuntime,
    "navigateBack" | "reLaunch"
  > = uni as unknown as CustomerDetailNavigationRuntime,
): void {
  if (pageCount > 1) {
    runtime.navigateBack();
    return;
  }
  runtime.reLaunch({ url: CUSTOMER_LIST_URL });
}
