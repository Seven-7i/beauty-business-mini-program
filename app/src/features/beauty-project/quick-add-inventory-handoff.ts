/**
 * 项目草稿与快速新增库存页之间的一次性回传槽。
 * 数据只存于当前小程序运行时，消费后立即清空，业务资料仍以 repository 为准。
 */
let createdInventoryItemId: string | undefined;

/** 记录快速新增成功的物品标识，供返回后的项目表单消费。 */
export function publishQuickAddedInventoryItem(itemId: string): void {
  createdInventoryItemId = itemId;
}

/** 查看最近一次结果；刷新和选中成功前不能清除。 */
export function peekQuickAddedInventoryItem(): string | undefined {
  return createdInventoryItemId;
}

/** 仅在来源表单确认选中后清除，旧 ID 不会误清新的回传结果。 */
export function acknowledgeQuickAddedInventoryItem(itemId: string): void {
  if (createdInventoryItemId === itemId) {
    createdInventoryItemId = undefined;
  }
}
