import { describe, expect, it } from "vitest";
import { validateAppointmentCompletionInput } from "./appointment-completion-validation";

describe("完成预约弹层输入校验", () => {
  const inventoryItems = [
    { id: "continuous", unitKind: "continuous" as const },
    { id: "discrete", unitKind: "discrete" as const },
  ];

  it("接受可保存的金额、时间和实际用量", () => {
    expect(
      validateAppointmentCompletionInput({
        transactionAmountInput: "82.50",
        completedDate: "2026-09-09",
        completedTime: "10:30",
        actualUsageInputs: [
          { inventoryItemId: "continuous", quantityInput: "1.25" },
          { inventoryItemId: "discrete", quantityInput: "2" },
        ],
        inventoryItems,
      }),
    ).toEqual({
      transactionAmount: "",
      completedAt: "",
      usageByInventoryItemId: {},
    });
  });

  it("分别返回金额、时间和每条用量的可修正错误", () => {
    expect(
      validateAppointmentCompletionInput({
        transactionAmountInput: "82.999",
        completedDate: "2026-02-30",
        completedTime: "10:30",
        actualUsageInputs: [
          { inventoryItemId: "continuous", quantityInput: "0" },
          { inventoryItemId: "discrete", quantityInput: "1.5" },
        ],
        inventoryItems,
      }),
    ).toEqual({
      transactionAmount: "请输入大于等于零、最多两位小数的金额",
      completedAt: "请选择有效的实际完成时间",
      usageByInventoryItemId: {
        continuous: "数量必须大于零",
        discrete: "离散单位数量必须为整数",
      },
    });
  });
});
