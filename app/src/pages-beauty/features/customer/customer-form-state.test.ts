import { describe, expect, it } from "vitest";
import {
  cloneCustomerAddressesForDraft,
  getCustomerFormErrorField,
  prepareCustomerAddressesForSubmit,
  shouldConfirmCustomerAddressRemoval,
} from "./customer-form-state";

describe("顾客表单状态", () => {
  it("编辑预填复制多地址并原样保留顺序、标识和备注", () => {
    const addresses = [
      { id: "address-home", addressText: "建设路 8 号", note: "东门" },
      { id: "address-studio", addressText: "人民路 16 号" },
    ];

    const draft = cloneCustomerAddressesForDraft(addresses);

    expect(draft).toEqual([
      { id: "address-home", addressText: "建设路 8 号", note: "东门" },
      { id: "address-studio", addressText: "人民路 16 号", note: "" },
    ]);
    expect(prepareCustomerAddressesForSubmit(draft, false)).toEqual(draft);
    expect(draft[0]).not.toBe(addresses[0]);
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

  it("新增模式只忽略全空占位，仍保留只填备注的无效地址供领域校验", () => {
    expect(
      prepareCustomerAddressesForSubmit(
        [
          { id: "blank", addressText: "", note: "" },
          { id: "invalid", addressText: "", note: "请电话联系" },
          { id: "valid", addressText: "建设路 8 号", note: "" },
        ],
        true,
      ),
    ).toEqual([
      { id: "invalid", addressText: "", note: "请电话联系" },
      { id: "valid", addressText: "建设路 8 号", note: "" },
    ]);
  });

  it("编辑模式保留被清空的已有地址，不允许静默当作删除", () => {
    expect(
      prepareCustomerAddressesForSubmit(
        [{ id: "existing", addressText: "", note: "" }],
        false,
      ),
    ).toEqual([{ id: "existing", addressText: "", note: "" }]);
  });

  it("只有地址正文或备注存在内容时才要求二次确认移除", () => {
    expect(
      shouldConfirmCustomerAddressRemoval({ addressText: "", note: "" }),
    ).toBe(false);
    expect(
      shouldConfirmCustomerAddressRemoval({ addressText: "  ", note: "\n" }),
    ).toBe(false);
    expect(
      shouldConfirmCustomerAddressRemoval({
        addressText: "建设路 8 号",
        note: "",
      }),
    ).toBe(true);
    expect(
      shouldConfirmCustomerAddressRemoval({
        addressText: "",
        note: "到东门联系",
      }),
    ).toBe(true);
  });
});
