import type {
  CustomerAddressInput,
  CustomerRuleErrorCode,
} from "@/services/customer-service";

/** 可承接业务校验错误的顾客表单区域。 */
export type CustomerFormField = "nickname" | "phone" | "address";

/** 顾客表单提交前可读取的服务地址草稿。 */
export interface CustomerAddressDraftInput {
  /** 顾客内部稳定地址标识。 */
  id: string;
  /** 尚未规范化的地址正文。 */
  addressText: string;
  /** 尚未规范化的地址备注。 */
  note: string;
}

/**
 * 生成提交给顾客服务的地址列表。
 * 独立新增页只忽略它自动提供的全空占位；内嵌编辑必须保留空行交给领域校验，避免静默删除地址。
 */
export function prepareCustomerAddressesForSubmit(
  addresses: readonly CustomerAddressDraftInput[],
  omitBlankPlaceholder: boolean,
): CustomerAddressInput[] {
  const submittedAddresses = omitBlankPlaceholder
    ? addresses.filter(
        (address) => address.addressText.trim() || address.note.trim(),
      )
    : addresses;
  return submittedAddresses.map((address) => ({
    id: address.id,
    addressText: address.addressText,
    note: address.note,
  }));
}

/** 地址正文或备注已有实际内容时，移除前需要取得用户确认。 */
export function shouldConfirmCustomerAddressRemoval(
  address: Pick<CustomerAddressDraftInput, "addressText" | "note">,
): boolean {
  return Boolean(address.addressText.trim() || address.note.trim());
}

/** 把稳定的领域错误码映射到应就近提示并定位的表单区域。 */
export function getCustomerFormErrorField(
  code: CustomerRuleErrorCode | "",
): CustomerFormField | undefined {
  if (code === "empty-nickname" || code === "duplicate-nickname") {
    return "nickname";
  }
  if (code === "invalid-phone" || code === "duplicate-phone") {
    return "phone";
  }
  if (code === "empty-address" || code === "duplicate-address-id") {
    return "address";
  }
  return undefined;
}

/** 有未保存改动时，离开表单必须先取得顾客的明确确认。 */
export function shouldConfirmCustomerDraftDiscard(dirty: boolean): boolean {
  return dirty;
}

/** 请求离开顾客表单；脏草稿由调用方取得确认后再执行离开动作。 */
export function requestCustomerFormExit(options: {
  /** 当前草稿是否偏离初始值。 */
  dirty: boolean;
  /** 打开平台确认框，并在用户确认时调用传入动作。 */
  confirmDiscard: (discard: () => void) => void;
  /** 真正清理草稿并切换页面内容的动作。 */
  exit: () => void;
}): void {
  if (!shouldConfirmCustomerDraftDiscard(options.dirty)) {
    options.exit();
    return;
  }
  options.confirmDiscard(options.exit);
}
