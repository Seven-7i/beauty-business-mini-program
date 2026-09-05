/** 服务项目页面导航所需的最小微信运行时。 */
export interface BeautyProjectNavigationRuntime {
  /** 进入独立服务项目子页面。 */
  navigateTo(options: { url: string }): unknown;
  /** 返回上一个页面。 */
  navigateBack(): unknown;
  /** 深链根页面重建到稳定的服务项目路由。 */
  reLaunch(options: { url: string }): unknown;
  /** 展示保存或删除完成反馈。 */
  showToast(options: { title: string; icon: "success" | "none" }): unknown;
}

/** 服务项目写入完成事件携带的最小业务信息。 */
export interface BeautyProjectChangedPayload {
  /** 被创建、更新、切换状态或删除的稳定项目标识。 */
  projectId: string;
  /** 来源页据此决定刷新当前详情还是只刷新列表。 */
  kind: "saved" | "status" | "deleted";
}

/** 服务项目编辑页与页面栈中来源页之间的应用级事件接口。 */
export interface BeautyProjectChangedEventRuntime {
  $emit(event: string, payload: BeautyProjectChangedPayload): unknown;
  $on(
    event: string,
    listener: (payload: BeautyProjectChangedPayload) => void,
  ): unknown;
  $off(
    event: string,
    listener: (payload: BeautyProjectChangedPayload) => void,
  ): unknown;
}

/** 服务项目列表的稳定页面地址。 */
export const BEAUTY_PROJECT_LIST_URL = "/pages/beauty-project/index";
/** 服务项目统一新增/编辑表单的稳定页面地址。 */
export const BEAUTY_PROJECT_EDITOR_URL = "/pages/beauty-project-create/index";
/** 项目仓储写入完成后通知仍在页面栈中的来源页。 */
export const BEAUTY_PROJECT_CHANGED_EVENT = "beauty-project:changed";

/**
 * 广播已经完成的项目写入；即使发起页已卸载，来源页仍可读回最新数据。
 */
export function notifyBeautyProjectChanged(
  payload: BeautyProjectChangedPayload,
  runtime: Pick<BeautyProjectChangedEventRuntime, "$emit"> =
    uni as unknown as BeautyProjectChangedEventRuntime,
): void {
  runtime.$emit(BEAUTY_PROJECT_CHANGED_EVENT, payload);
}

/** 订阅项目写入完成事件，并返回必须在页面卸载时调用的清理函数。 */
export function subscribeBeautyProjectChanged(
  listener: (payload: BeautyProjectChangedPayload) => void,
  runtime: Pick<BeautyProjectChangedEventRuntime, "$on" | "$off"> =
    uni as unknown as BeautyProjectChangedEventRuntime,
): () => void {
  runtime.$on(BEAUTY_PROJECT_CHANGED_EVENT, listener);
  return () => runtime.$off(BEAUTY_PROJECT_CHANGED_EVENT, listener);
}

/** 构造只携带稳定项目标识的详情页地址。 */
export function buildBeautyProjectDetailUrl(projectId: string): string {
  return `/pages/beauty-project-detail/index?projectId=${encodeURIComponent(projectId)}`;
}

/** 无项目标识时构造新增地址，有标识时构造编辑地址。 */
export function buildBeautyProjectEditorUrl(projectId = ""): string {
  return projectId
    ? `${BEAUTY_PROJECT_EDITOR_URL}?projectId=${encodeURIComponent(projectId)}`
    : BEAUTY_PROJECT_EDITOR_URL;
}

/** 从 uni-app 页面参数读取项目标识；缺失或全空参数返回空字符串。 */
export function readBeautyProjectId(
  query?: Readonly<Record<string, string | undefined>>,
): string {
  return query?.projectId?.trim() ?? "";
}

/** 从列表或其他业务入口进入独立项目详情。 */
export function openBeautyProjectDetail(
  projectId: string,
  runtime: Pick<BeautyProjectNavigationRuntime, "navigateTo"> =
    uni as unknown as BeautyProjectNavigationRuntime,
): void {
  runtime.navigateTo({ url: buildBeautyProjectDetailUrl(projectId) });
}

/** 从列表进入新增模式，或从详情进入同一表单的编辑模式。 */
export function openBeautyProjectEditor(
  projectId = "",
  runtime: Pick<BeautyProjectNavigationRuntime, "navigateTo"> =
    uni as unknown as BeautyProjectNavigationRuntime,
): void {
  runtime.navigateTo({ url: buildBeautyProjectEditorUrl(projectId) });
}

/** 有上一页时返回来源，深链根页面则重建到服务项目列表。 */
export function returnToBeautyProjectList(
  pageCount: number = getCurrentPages().length,
  runtime: Pick<BeautyProjectNavigationRuntime, "navigateBack" | "reLaunch"> =
    uni as unknown as BeautyProjectNavigationRuntime,
): void {
  if (pageCount > 1) {
    runtime.navigateBack();
    return;
  }
  runtime.reLaunch({ url: BEAUTY_PROJECT_LIST_URL });
}

/**
 * 服务项目保存成功后先反馈，再返回来源页或为深链根页面重建稳定去向。
 * 新增根页面回列表；编辑根页面回当前项目详情。
 */
export function completeBeautyProjectEditorNavigation(
  projectId: string,
  editing: boolean,
  runtime: Pick<
    BeautyProjectNavigationRuntime,
    "showToast" | "navigateBack" | "reLaunch"
  > = uni as unknown as BeautyProjectNavigationRuntime,
  pageCount: number = getCurrentPages().length,
): void {
  runtime.showToast({
    title: editing ? "项目资料已更新" : "服务项目已保存",
    icon: "success",
  });
  if (pageCount > 1) {
    runtime.navigateBack();
    return;
  }
  runtime.reLaunch({
    url: editing
      ? buildBeautyProjectDetailUrl(projectId)
      : BEAUTY_PROJECT_LIST_URL,
  });
}

/** 彻底删除服务项目后先提示结果，再返回列表或重建深链入口。 */
export function completeBeautyProjectDeletion(
  runtime: Pick<
    BeautyProjectNavigationRuntime,
    "showToast" | "navigateBack" | "reLaunch"
  > = uni as unknown as BeautyProjectNavigationRuntime,
  pageCount: number = getCurrentPages().length,
): void {
  runtime.showToast({ title: "项目已删除", icon: "none" });
  returnToBeautyProjectList(pageCount, runtime);
}
