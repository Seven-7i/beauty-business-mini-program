/** 独立新增顾客页完成保存时需要的最小导航运行时。 */
export interface CustomerCreateNavigationRuntime {
  /** 展示保存成功反馈。 */
  showToast(options: { title: string; icon: "success" }): unknown;
  /** 返回上一个页面。 */
  navigateBack(): unknown;
}

/** 顾客列表路由在重新显示时可刷新的最小公开契约。 */
export interface CustomerListRefreshTarget {
  /** 重新读取顾客与预约快照。 */
  refresh(): Promise<void>;
}

/**
 * 完成新增顾客后的成功反馈与返回动作。
 * 当前由 `CustomerCreate` 调用；运行时可注入，以验证保存成功后的导航顺序。
 */
export function completeCustomerCreateNavigation(
  runtime: CustomerCreateNavigationRuntime =
    uni as unknown as CustomerCreateNavigationRuntime,
): void {
  runtime.showToast({ title: "顾客资料已保存", icon: "success" });
  runtime.navigateBack();
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
