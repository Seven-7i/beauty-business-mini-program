import { describe, expect, it } from "vitest";
import type { InventoryMovementV1 } from "@/domain/data-schema";
import { filterInventoryMovementsForItem } from "./composables/useInventoryManagement";

/** 构造筛选排序测试所需的最小完整库存动态。 */
function movement(
  id: string,
  inventoryItemId: string,
  occurredAt: string,
): InventoryMovementV1 {
  return {
    id,
    inventoryItemId,
    type: "restock",
    beforeQuantity: "0",
    deltaQuantity: "1",
    afterQuantity: "1",
    occurredAt,
    appointmentDeleted: false,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    schemaVersion: 1,
  };
}

describe("filterInventoryMovementsForItem", () => {
  it("只返回当前物品的动态并按发生时间倒序排列", () => {
    const movements = [
      movement("older", "item-a", "2026-09-01T08:00:00.000Z"),
      movement("other", "item-b", "2026-09-03T08:00:00.000Z"),
      movement("newer", "item-a", "2026-09-02T08:00:00.000Z"),
    ];

    expect(
      filterInventoryMovementsForItem(movements, "item-a").map(({ id }) => id),
    ).toEqual(["newer", "older"]);
  });

  it("不会改变统一库存流水的原始顺序", () => {
    const movements = [
      movement("older", "item-a", "2026-09-01T08:00:00.000Z"),
      movement("newer", "item-a", "2026-09-02T08:00:00.000Z"),
    ];

    filterInventoryMovementsForItem(movements, "item-a");

    expect(movements.map(({ id }) => id)).toEqual(["older", "newer"]);
  });
});
