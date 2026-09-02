import { describe, expect, it, vi } from "vitest";
import { createCustomerDraftProtectionController } from "./composables/useCustomerDraftProtection";

describe("顾客草稿返回保护", () => {
  it("脏草稿启用原生保护，保存或卸载前会解除保护", () => {
    const enableAlertBeforeUnload = vi.fn();
    const disableAlertBeforeUnload = vi.fn();
    const protection = createCustomerDraftProtectionController({
      wechat: { enableAlertBeforeUnload, disableAlertBeforeUnload },
    });

    protection.updateDirty(true);
    expect(enableAlertBeforeUnload).toHaveBeenCalledWith({
      message: "放弃本次编辑？",
    });

    protection.resetDirty();
    expect(disableAlertBeforeUnload).toHaveBeenCalledOnce();
  });

  it("保存期间使用明确提示，失败后恢复原有脏草稿保护", () => {
    const enableAlertBeforeUnload = vi.fn();
    const disableAlertBeforeUnload = vi.fn();
    const protection = createCustomerDraftProtectionController({
      wechat: { enableAlertBeforeUnload, disableAlertBeforeUnload },
    });

    protection.updateDirty(true);
    protection.updateSaving(true);
    expect(enableAlertBeforeUnload).toHaveBeenLastCalledWith({
      message: "顾客资料正在保存，离开后仍会完成保存。",
    });

    protection.updateSaving(false);
    expect(enableAlertBeforeUnload).toHaveBeenLastCalledWith({
      message: "放弃本次编辑？",
    });
    expect(disableAlertBeforeUnload).not.toHaveBeenCalled();
  });
});
