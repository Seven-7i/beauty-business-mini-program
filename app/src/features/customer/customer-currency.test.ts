import { describe, expect, it } from "vitest";
import { formatCustomerCurrency } from "./customer-currency";

describe("顾客金额展示", () => {
  it("保留两位小数并添加千分位", () => {
    expect(formatCustomerCurrency(0)).toBe("¥0.00");
    expect(formatCustomerCurrency(580000)).toBe("¥5,800.00");
    expect(formatCustomerCurrency(123456789)).toBe("¥1,234,567.89");
  });
});
