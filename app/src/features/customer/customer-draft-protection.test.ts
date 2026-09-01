import { describe, expect, it, vi } from "vitest";
import { createCustomerDraftProtectionController } from "./composables/useCustomerDraftProtection";

describe("顾客草稿返回保护", () => {
  it("脏草稿启用原生保护，保存或卸载前会解除保护", () => {
    const enableAlertBeforeUnload = vi.fn();
    const disableAlertBeforeUnload = vi.fn();
    const protection = createCustomerDraftProtectionController({
      wechat: { enableAlertBeforeUnload, disableAlertBeforeUnload },
      confirmDiscard: vi.fn(),
    });

    protection.updateDirty(true);
    expect(enableAlertBeforeUnload).toHaveBeenCalledWith({
      message: "放弃本次编辑？",
    });

    protection.resetDirty();
    expect(disableAlertBeforeUnload).toHaveBeenCalledOnce();
  });

  it("干净草稿直接退出，脏草稿只在确认后退出", () => {
    let pendingDiscard: (() => void) | undefined;
    const confirmDiscard = vi.fn((discard: () => void) => {
      pendingDiscard = discard;
    });
    const protection = createCustomerDraftProtectionController({
      confirmDiscard,
    });
    const cleanExit = vi.fn();

    protection.requestExit(cleanExit);
    expect(cleanExit).toHaveBeenCalledOnce();
    expect(confirmDiscard).not.toHaveBeenCalled();

    protection.updateDirty(true);
    const dirtyExit = vi.fn();
    protection.requestExit(dirtyExit);
    expect(dirtyExit).not.toHaveBeenCalled();
    expect(confirmDiscard).toHaveBeenCalledOnce();

    pendingDiscard?.();
    expect(dirtyExit).toHaveBeenCalledOnce();
  });
});
