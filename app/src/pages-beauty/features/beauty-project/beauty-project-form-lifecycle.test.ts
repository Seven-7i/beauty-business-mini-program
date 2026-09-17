import { describe, expect, it, vi } from "vitest";
import {
  createBeautyProjectDraftProtectionController,
  createBeautyProjectFormCompletionGuard,
} from "./composables/useBeautyProjectFormLifecycle";

describe("服务项目表单生命周期保护", () => {
  it("脏草稿、保存中和恢复编辑使用对应的原生返回提示", () => {
    const enableAlertBeforeUnload = vi.fn();
    const disableAlertBeforeUnload = vi.fn();
    const protection = createBeautyProjectDraftProtectionController({
      wechat: { enableAlertBeforeUnload, disableAlertBeforeUnload },
    });

    protection.updateDirty(true);
    protection.updateSaving(true);
    protection.updateDirty(true);
    expect(enableAlertBeforeUnload).toHaveBeenLastCalledWith({
      message: "服务项目正在保存，离开后仍会完成保存。",
    });
    protection.updateSaving(false);
    protection.resetDirty();

    expect(enableAlertBeforeUnload).toHaveBeenNthCalledWith(1, {
      message: "放弃本次编辑？",
    });
    expect(enableAlertBeforeUnload).toHaveBeenNthCalledWith(2, {
      message: "服务项目正在保存，离开后仍会完成保存。",
    });
    expect(enableAlertBeforeUnload).toHaveBeenNthCalledWith(3, {
      message: "服务项目正在保存，离开后仍会完成保存。",
    });
    expect(enableAlertBeforeUnload).toHaveBeenNthCalledWith(4, {
      message: "放弃本次编辑？",
    });
    expect(disableAlertBeforeUnload).toHaveBeenCalledOnce();
  });

  it("组件卸载后关闭异步保存完成动作", () => {
    const guard = createBeautyProjectFormCompletionGuard();

    expect(guard.isActive()).toBe(true);
    guard.deactivate();
    expect(guard.isActive()).toBe(false);
  });
});
