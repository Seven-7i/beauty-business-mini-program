import { describe, expect, it, vi } from "vitest";
import type { CustomerV1 } from "@/domain/data-schema";
import type { CustomerEditorService } from "@/services/customer-management-service";
import { CustomerRuleError } from "@/services/customer-service";
import { useCustomerEditor } from "./composables/useCustomerManagement";

const customer: CustomerV1 = {
  id: "customer-1",
  nickname: "张女士",
  phone: "13800138000",
  addresses: [
    {
      id: "address-home",
      addressText: "建设路 8 号",
      note: "到东门联系",
    },
    {
      id: "address-studio",
      addressText: "人民路 16 号",
      note: "二楼",
    },
  ],
  status: "active",
  createdAt: "2026-08-01T08:00:00.000Z",
  updatedAt: "2026-08-01T08:00:00.000Z",
  schemaVersion: 1,
};

/** 创建统一顾客表单页测试所需的最窄服务桩。 */
function createService(): CustomerEditorService {
  return {
    readCustomer: vi.fn().mockResolvedValue(customer),
    createCustomer: vi.fn().mockResolvedValue(customer),
    updateCustomer: vi.fn().mockResolvedValue(customer),
  };
}

describe("统一顾客表单页状态", () => {
  it("新增模式不读取顾客集合并调用创建用例", async () => {
    const service = createService();
    const editor = useCustomerEditor(service);
    const input = {
      nickname: "小雨",
      phone: "13900139000",
      addresses: [],
    };

    expect(editor.isEditing).toBe(false);
    expect(await editor.loadCustomer()).toBe(true);
    expect(service.readCustomer).not.toHaveBeenCalled();
    expect(await editor.saveCustomer(input)).toBe(true);
    expect(service.createCustomer).toHaveBeenCalledWith(input);
    expect(service.updateCustomer).not.toHaveBeenCalled();
  });

  it("编辑模式读取当前顾客并把稳定标识交给更新用例", async () => {
    const service = createService();
    const editor = useCustomerEditor(service, customer.id);
    const input = {
      nickname: "张女士",
      phone: "13800138000",
      addresses: customer.addresses,
    };

    expect(editor.isEditing).toBe(true);
    expect(await editor.loadCustomer()).toBe(true);
    expect(editor.customer.value).toEqual(customer);
    expect(service.readCustomer).toHaveBeenCalledWith(customer.id);
    expect(await editor.saveCustomer(input)).toBe(true);
    expect(service.updateCustomer).toHaveBeenCalledWith({
      customerId: customer.id,
      ...input,
    });
    expect(service.createCustomer).not.toHaveBeenCalled();
  });

  it("编辑目标不存在时阻止误写并暴露恢复状态", async () => {
    const service = createService();
    vi.mocked(service.readCustomer).mockResolvedValueOnce(undefined);
    const editor = useCustomerEditor(service, customer.id);

    expect(await editor.loadCustomer()).toBe(false);
    expect(editor.customer.value).toBeUndefined();
    expect(editor.errorKind.value).toBe("missing");
    expect(editor.errorMessage.value).toContain("顾客不存在");
  });

  it("读取失败后允许重试并恢复当前顾客资料", async () => {
    const service = createService();
    vi.mocked(service.readCustomer).mockRejectedValueOnce(new Error("storage"));
    const editor = useCustomerEditor(service, customer.id);

    expect(await editor.loadCustomer()).toBe(false);
    expect(editor.errorKind.value).toBe("read");
    expect(editor.customer.value).toBeUndefined();

    expect(await editor.loadCustomer()).toBe(true);
    expect(editor.errorKind.value).toBe("");
    expect(editor.customer.value).toEqual(customer);
  });

  it("保存失败时保留领域错误码，修改草稿后可以清除", async () => {
    const service = createService();
    vi.mocked(service.updateCustomer).mockRejectedValueOnce(
      new CustomerRuleError("duplicate-phone", "该手机号已用于其他顾客"),
    );
    const editor = useCustomerEditor(service, customer.id);

    expect(
      await editor.saveCustomer({
        nickname: "张女士",
        phone: "13900139000",
        addresses: [],
      }),
    ).toBe(false);
    expect(editor.errorKind.value).toBe("operation");
    expect(editor.errorCode.value).toBe("duplicate-phone");
    expect(editor.errorMessage.value).toBe("该手机号已用于其他顾客");

    editor.clearError();
    expect(editor.errorCode.value).toBe("");
    expect(editor.errorMessage.value).toBe("");
  });
});
