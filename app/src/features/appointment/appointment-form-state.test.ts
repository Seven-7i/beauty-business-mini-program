import { describe, expect, it } from "vitest";
import {
  applyProjectSelection,
  buildCompletionUsageDrafts,
  buildDefaultUsageDrafts,
} from "./appointment-form-state";
import { addDecimalQuantities } from "@/utils/decimal-quantity";

describe("预约表单项目选择", () => {
  it("选择器确认项目后立即加入预约项目组合", () => {
    expect(applyProjectSelection([], "project-1")).toEqual({
      projectIds: ["project-1"],
      changed: true,
    });
  });

  it("重复选择已有项目时不改变项目组合", () => {
    expect(applyProjectSelection(["project-1"], "project-1")).toEqual({
      projectIds: ["project-1"],
      changed: false,
    });
  });
});

describe("预约默认用量草稿", () => {
  it("按项目组合合并相同库存物品的正常用量", () => {
    expect(
      buildDefaultUsageDrafts(
        ["project-1", "project-2"],
        [
          {
            id: "project-1",
            defaultUsages: [
              { inventoryItemId: "item-1", quantity: "1.25" },
            ],
          },
          {
            id: "project-2",
            defaultUsages: [
              { inventoryItemId: "item-1", quantity: "0.75" },
              { inventoryItemId: "item-2", quantity: "1" },
            ],
          },
        ],
        addDecimalQuantities,
      ),
    ).toEqual([
      { inventoryItemId: "item-1", quantityInput: "2" },
      { inventoryItemId: "item-2", quantityInput: "1" },
    ]);
  });

  it("完成预约优先沿用已保存的预计用量快照", () => {
    expect(
      buildCompletionUsageDrafts(
        [{ inventoryItemId: "item-1", quantity: "3" }],
        ["project-1"],
        [
          {
            id: "project-1",
            defaultUsages: [{ inventoryItemId: "item-1", quantity: "1" }],
          },
        ],
        addDecimalQuantities,
      ),
    ).toEqual([{ inventoryItemId: "item-1", quantityInput: "3" }]);
  });

  it("完成历史空快照预约时回退项目正常用量", () => {
    expect(
      buildCompletionUsageDrafts(
        [],
        ["project-1", "project-2"],
        [
          {
            id: "project-1",
            defaultUsages: [{ inventoryItemId: "item-1", quantity: "1.5" }],
          },
          {
            id: "project-2",
            defaultUsages: [
              { inventoryItemId: "item-1", quantity: "0.5" },
              { inventoryItemId: "item-2", quantity: "2" },
            ],
          },
        ],
        addDecimalQuantities,
      ),
    ).toEqual([
      { inventoryItemId: "item-1", quantityInput: "2" },
      { inventoryItemId: "item-2", quantityInput: "2" },
    ]);
  });
});
