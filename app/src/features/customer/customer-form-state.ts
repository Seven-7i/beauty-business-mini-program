import type {
  CustomerAddressInput,
  CustomerRuleErrorCode,
} from "@/services/customer-service";
import type { CustomerV1 } from "@/domain/data-schema";

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
 * 把已有顾客地址复制成可编辑草稿，保留顺序、稳定标识和备注。
 * 当前由 `CustomerForm` 的编辑模式预填调用；返回新对象，避免直接修改领域实体。
 */
export function cloneCustomerAddressesForDraft(
  addresses: readonly Readonly<CustomerV1["addresses"][number]>[],
): CustomerAddressDraftInput[] {
  return addresses.map((address) => ({
    id: address.id,
    addressText: address.addressText,
    note: address.note ?? "",
  }));
}

/**
 * 生成提交给顾客服务的地址列表。
 * 新增模式只忽略它自动提供的全空占位；编辑模式必须保留空行交给领域校验，避免静默删除地址。
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
