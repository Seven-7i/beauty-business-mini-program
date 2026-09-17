import { describe, expect, it, vi } from "vitest";
import { CustomerRuleError } from "@/services/customer-service";
import type { CustomerManagementService } from "@/services/customer-management-service";
import { useCustomerManagement } from "./composables/useCustomerManagement";

describe("顾客管理提交状态", () => {
  it("保留领域错误码供表单就近提示，并允许修改草稿后清除", async () => {
    const service = {
      createCustomer: vi
        .fn()
        .mockRejectedValue(
          new CustomerRuleError("duplicate-phone", "该手机号已用于其他顾客"),
        ),
    } as unknown as CustomerManagementService;
    const management = useCustomerManagement(service);

    const saved = await management.createCustomer({
      nickname: "小雨",
      phone: "13800000000",
      addresses: [],
    });

    expect(saved).toBe(false);
    expect(management.errorKind.value).toBe("operation");
    expect(management.errorCode.value).toBe("duplicate-phone");
    expect(management.errorMessage.value).toBe("该手机号已用于其他顾客");

    management.clearError();
    expect(management.errorCode.value).toBe("");
    expect(management.errorMessage.value).toBe("");
  });
});
