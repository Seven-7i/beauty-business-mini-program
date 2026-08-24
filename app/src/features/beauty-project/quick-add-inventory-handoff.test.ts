import { describe, expect, it } from "vitest";
import {
  acknowledgeQuickAddedInventoryItem,
  peekQuickAddedInventoryItem,
  publishQuickAddedInventoryItem,
} from "./quick-add-inventory-handoff";

describe("项目快速新增库存回传", () => {
  it("刷新失败时保留结果，只有确认选中后才清除", () => {
    publishQuickAddedInventoryItem("item-new");
    expect(peekQuickAddedInventoryItem()).toBe("item-new");

    // 第一次刷新失败时不调用 acknowledge，下一次显示仍能重试。
    expect(peekQuickAddedInventoryItem()).toBe("item-new");
    acknowledgeQuickAddedInventoryItem("stale-item");
    expect(peekQuickAddedInventoryItem()).toBe("item-new");

    acknowledgeQuickAddedInventoryItem("item-new");
    expect(peekQuickAddedInventoryItem()).toBeUndefined();
  });
});
