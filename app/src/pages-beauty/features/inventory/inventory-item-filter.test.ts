import { describe, expect, it } from "vitest";
import { filterInventoryItems } from "./composables/useInventoryManagement";

const summaries = [
  { item: { name: "玻尿酸原液", status: "active" as const } },
  { item: { name: "一次性面膜", status: "active" as const } },
  { item: { name: "停用修护膏", status: "inactive" as const } },
];

describe("filterInventoryItems", () => {
  it("默认只展示启用库存物品", () => {
    expect(filterInventoryItems(summaries, "", false)).toEqual(
      summaries.slice(0, 2),
    );
  });

  it("仅看停用时只展示停用库存物品", () => {
    expect(filterInventoryItems(summaries, "", true)).toEqual([summaries[2]]);
  });

  it("只按当前状态范围内的名称匹配，并忽略首尾空格", () => {
    expect(filterInventoryItems(summaries, " 面膜 ", false)).toEqual([
      summaries[1],
    ]);
    expect(filterInventoryItems(summaries, "修护", false)).toEqual([]);
    expect(filterInventoryItems(summaries, "修护", true)).toEqual([
      summaries[2],
    ]);
  });
});
