import { describe, expect, it } from "vitest";
import {
  DecimalQuantityError,
  addDecimalQuantities,
  parseDecimalQuantity,
} from "./decimal-quantity";

describe("定点库存数量", () => {
  it("连续单位规范化到最多两位小数且不产生浮点误差", () => {
    expect(parseDecimalQuantity(" 1.20 ", { unitKind: "continuous" })).toBe("1.2");
    expect(addDecimalQuantities("0.1", "0.2")).toBe("0.3");
  });

  it("离散单位拒绝小数", () => {
    expect(() => parseDecimalQuantity("1.5", { unitKind: "discrete" })).toThrow(
      new DecimalQuantityError("离散单位数量必须为整数"),
    );
  });

  it("正数操作拒绝零和负数", () => {
    expect(() =>
      parseDecimalQuantity("0", { unitKind: "continuous", positive: true }),
    ).toThrow("数量必须大于零");
  });
});
