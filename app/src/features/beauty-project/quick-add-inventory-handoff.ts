/**
 * 项目草稿与快速新增库存页之间的一次性回传槽。
 * 数据只存于当前小程序运行时，消费后立即清空，业务资料仍以 repository 为准。
 */
let createdInventoryItem:
  | { requestId: string; inventoryItemId: string }
  | undefined;
let expectedQuickAddRequestId: string | undefined;
let quickAddRequestSequence = 0;

/**
 * 为项目表单打开库存新增页生成一次性来源标识。
 * 当前由独立服务项目表单路由调用；新请求会替换尚未使用的旧请求，避免过期页面继续回传。
 */
export function beginQuickAddInventoryRequest(): string {
  quickAddRequestSequence += 1;
  expectedQuickAddRequestId = `inventory-quick-add-${Date.now()}-${quickAddRequestSequence}`;
  return expectedQuickAddRequestId;
}

/**
 * 在导航失败时撤销尚未被新增页接收的来源标识。
 * 当前由独立服务项目表单路由的 `navigateTo.fail` 调用，不会误清后续新请求。
 */
export function cancelQuickAddInventoryRequest(requestId: string): void {
  if (expectedQuickAddRequestId === requestId) {
    expectedQuickAddRequestId = undefined;
  }
  if (createdInventoryItem?.requestId === requestId) {
    createdInventoryItem = undefined;
  }
}

/**
 * 一次性验证并消费快速新增来源标识。
 * 当前由库存新增导航解析器调用；未知、过期或重复请求均按普通新增处理。
 */
export function acceptQuickAddInventoryRequest(requestId: string): boolean {
  if (!requestId || expectedQuickAddRequestId !== requestId) {
    return false;
  }
  expectedQuickAddRequestId = undefined;
  return true;
}

/** 库存新增页只识别的路由参数。 */
export interface InventoryCreateRouteQuery {
  /** 快速新增来源类型。 */
  mode?: string;
  /** 服务项目页生成的一次性来源标识。 */
  requestId?: string;
}

/** 完成库存新增导航所需的最小运行时。 */
export interface InventoryCreateNavigationRuntime {
  /** 返回当前小程序页面栈深度。 */
  getPageCount(): number;
  /** 显示保存成功反馈。 */
  showSavedToast(): void;
  /** 返回仍在页面栈中的直接来源。 */
  navigateBack(): void;
  /** 深链根页面保存后重建到库存列表。 */
  relaunchInventory(): void;
}

/** 旧库存快速新增入口跳转到独立新增页的结果。 */
export interface LegacyInventoryQuickAddRedirect {
  /** 独立新增页地址。 */
  url: string;
  /** 存在项目来源时生成的待接收标识。 */
  requestId?: string;
}

/**
 * 验证库存新增页是否来自仍在页面栈中的服务项目表单。
 * 当前由 `pages/inventory-create/index` 调用；伪造、过期和根页面请求均降级为普通新增。
 */
export function resolveInventoryCreateQuickAddMode(
  query: InventoryCreateRouteQuery | undefined,
  pageCount: number,
): boolean {
  return Boolean(resolveInventoryCreateQuickAddRequestId(query, pageCount));
}

/**
 * 验证快速新增来源并返回所属编辑器持有的一次性请求标识。
 * 当前由库存新增路由保存该标识，确保结果不会被其他项目编辑器误领。
 */
export function resolveInventoryCreateQuickAddRequestId(
  query: InventoryCreateRouteQuery | undefined,
  pageCount: number,
): string {
  if (query?.mode !== "project-quick-add") {
    return "";
  }
  const requestId = query.requestId?.trim() ?? "";
  const accepted = acceptQuickAddInventoryRequest(requestId);
  return accepted && pageCount > 1 ? requestId : "";
}

/**
 * 把旧库存页快速新增地址桥接到带一次性来源标识的独立新增页。
 * 当前由 `pages/inventory/index` 调用；根页面旧链接只进入普通新增，不能写入项目回传槽。
 */
export function prepareLegacyInventoryQuickAddRedirect(
  pageCount: number,
): LegacyInventoryQuickAddRedirect {
  if (pageCount <= 1) {
    return { url: "/pages/inventory-create/index" };
  }
  const requestId = beginQuickAddInventoryRequest();
  return {
    requestId,
    url: `/pages/inventory-create/index?mode=project-quick-add&requestId=${encodeURIComponent(requestId)}`,
  };
}

/**
 * 完成库存新增后的来源回传与返回。
 * 当前由 `pages/inventory-create/index` 调用；普通新增不会写入项目快速新增回传槽。
 */
export function completeInventoryCreateNavigation(
  inventoryItemId: string,
  quickAddRequestId: string | boolean,
  runtime: InventoryCreateNavigationRuntime,
): void {
  if (quickAddRequestId) {
    publishQuickAddedInventoryItem(
      inventoryItemId,
      typeof quickAddRequestId === "string" ? quickAddRequestId : "",
    );
  }
  runtime.showSavedToast();
  if (runtime.getPageCount() > 1) {
    runtime.navigateBack();
    return;
  }
  runtime.relaunchInventory();
}

/** 记录快速新增成功的物品标识，供返回后的项目表单消费。 */
export function publishQuickAddedInventoryItem(
  itemId: string,
  requestId = "",
): void {
  createdInventoryItem = { requestId, inventoryItemId: itemId };
}

/** 查看当前编辑器所属结果；刷新和选中成功前不能清除。 */
export function peekQuickAddedInventoryItem(
  requestId = "",
): string | undefined {
  return createdInventoryItem?.requestId === requestId
    ? createdInventoryItem.inventoryItemId
    : undefined;
}

/** 仅在来源表单确认选中后清除，旧 ID 不会误清新的回传结果。 */
export function acknowledgeQuickAddedInventoryItem(
  itemId: string,
  requestId = "",
): void {
  if (
    createdInventoryItem?.inventoryItemId === itemId &&
    createdInventoryItem.requestId === requestId
  ) {
    createdInventoryItem = undefined;
  }
}
