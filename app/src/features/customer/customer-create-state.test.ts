import { describe, expect, it, vi } from "vitest";
import type { CustomerCreateService } from "@/services/customer-management-service";
import { CustomerRuleError } from "@/services/customer-service";
import { useCustomerCreate } from "./composables/useCustomerCreate";

describe("独立新增顾客提交状态", () => {
  it("成功创建后结束提交且不保留错误", async () => {
    const createCustomer = vi.fn().mockResolvedValue({ id: "customer-1" });
    const service: CustomerCreateService = { createCustomer };
    const creation = useCustomerCreate(service);

    const saved = await creation.createCustomer({
      nickname: "小雨",
      phone: "13800000000",
      addresses: [],
    });

    expect(saved).toBe(true);
    expect(createCustomer).toHaveBeenCalledOnce();
    expect(creation.submitting.value).toBe(false);
    expect(creation.errorMessage.value).toBe("");
    expect(creation.errorCode.value).toBe("");
  });

  it("保留领域错误码，并允许用户修改草稿后清除", async () => {
    const service = {
      createCustomer: vi.fn().mockRejectedValue(
        new CustomerRuleError(
          "duplicate-phone",
          "该手机号已用于其他顾客",
        ),
      ),
    } as CustomerCreateService;
    const creation = useCustomerCreate(service);

    const saved = await creation.createCustomer({
      nickname: "小雨",
      phone: "13800000000",
      addresses: [],
    });

    expect(saved).toBe(false);
    expect(creation.errorCode.value).toBe("duplicate-phone");
    expect(creation.errorMessage.value).toBe("该手机号已用于其他顾客");

    creation.clearError();
    expect(creation.errorCode.value).toBe("");
    expect(creation.errorMessage.value).toBe("");
  });
});
