import { describe, expect, it, vi } from "vitest";
import {
  getCustomerFormErrorField,
  getCustomerScreenAfterFormExit,
  requestCustomerFormExit,
  shouldConfirmCustomerDraftDiscard,
} from "./customer-form-state";

describe("顾客表单状态", () => {
  it("新增结束回列表，编辑结束回详情", () => {
    expect(getCustomerScreenAfterFormExit(undefined)).toBe("list");
    expect(getCustomerScreenAfterFormExit("customer-1")).toBe("detail");
  });

  it("只在存在未保存改动时要求确认放弃", () => {
    expect(shouldConfirmCustomerDraftDiscard(false)).toBe(false);
    expect(shouldConfirmCustomerDraftDiscard(true)).toBe(true);
  });

  it("干净草稿直接退出，脏草稿只有确认后才退出", () => {
    const cleanExit = vi.fn();
    const cleanConfirm = vi.fn();
    requestCustomerFormExit({
      dirty: false,
      confirmDiscard: cleanConfirm,
      exit: cleanExit,
    });
    expect(cleanExit).toHaveBeenCalledOnce();
    expect(cleanConfirm).not.toHaveBeenCalled();

    const dirtyExit = vi.fn();
    let confirmDiscard: (() => void) | undefined;
    requestCustomerFormExit({
      dirty: true,
      confirmDiscard(discard) {
        confirmDiscard = discard;
      },
      exit: dirtyExit,
    });
    expect(dirtyExit).not.toHaveBeenCalled();
    confirmDiscard?.();
    expect(dirtyExit).toHaveBeenCalledOnce();
  });

  it.each([
    ["empty-nickname", "nickname"],
    ["duplicate-nickname", "nickname"],
    ["invalid-phone", "phone"],
    ["duplicate-phone", "phone"],
    ["empty-address", "address"],
    ["duplicate-address-id", "address"],
    ["referenced-customer", undefined],
  ] as const)("把 %s 定位到 %s", (code, field) => {
    expect(getCustomerFormErrorField(code)).toBe(field);
  });
});
