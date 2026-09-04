import { describe, expect, it, vi } from "vitest";
import {
  createInventoryDraftProtectionController,
  createInventoryFormCompletionGuard,
} from "./composables/useInventoryFormLifecycle";

describe("库存表单生命周期保护", () => {
  it("脏草稿、保存中和恢复编辑使用对应的原生返回提示", () => {
    const enableAlertBeforeUnload = vi.fn();
    const disableAlertBeforeUnload = vi.fn();
    const protection = createInventoryDraftProtectionController({
      wechat: { enableAlertBeforeUnload, disableAlertBeforeUnload },
    });

    protection.updateDirty(true);
    protection.updateSaving(true);
    protection.updateSaving(false);
    protection.resetDirty();

    expect(enableAlertBeforeUnload).toHaveBeenNthCalledWith(1, {
      message: "放弃本次编辑？",
    });
    expect(enableAlertBeforeUnload).toHaveBeenNthCalledWith(2, {
      message: "库存数据正在保存，离开后仍会完成保存。",
    });
    expect(enableAlertBeforeUnload).toHaveBeenNthCalledWith(3, {
      message: "放弃本次编辑？",
    });
    expect(disableAlertBeforeUnload).toHaveBeenCalledOnce();
  });

  it("组件卸载后关闭异步完成动作", () => {
    const guard = createInventoryFormCompletionGuard();

    expect(guard.isActive()).toBe(true);
    guard.deactivate();
    expect(guard.isActive()).toBe(false);
  });
});
