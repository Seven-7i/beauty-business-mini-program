import type {
  AppointmentV1,
  CustomerAddressV1,
  CustomerV1,
} from "@/domain/data-schema";

/** 顾客校验的稳定错误分类，避免页面依赖可能调整的中文文案。 */
export type CustomerRuleErrorCode =
  | "empty-nickname"
  | "duplicate-nickname"
  | "invalid-phone"
  | "duplicate-phone"
  | "empty-address"
  | "duplicate-address-id"
  | "referenced-customer";

/** 顾客资料校验失败；code 供页面按稳定原因显示或定位字段。 */
export class CustomerRuleError extends Error {
  constructor(
    readonly code: CustomerRuleErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CustomerRuleError";
  }
}

export interface CustomerAddressInput {
  /** 顾客范围内稳定且唯一的地址标识。 */
  id: string;
  /** 上门服务地址正文，保存时去除首尾空白。 */
  addressText: string;
  /** 可选地址说明，空白值不写入数据。 */
  note?: string;
}

export interface NormalizeCustomerInput {
  /** 所有未删除顾客中唯一的昵称。 */
  nickname: string;
  /** 中国大陆 11 位手机号。 */
  phone: string;
  /** 不设置默认项的顾客服务地址列表。 */
  addresses: readonly CustomerAddressInput[];
  /** 包含启用和停用记录；停用顾客仍占用昵称和手机号。 */
  existingCustomers: readonly CustomerV1[];
  /** 编辑顾客时从唯一性检查中排除自身。 */
  editingCustomerId?: string;
}

/** 通过校验后可直接写入顾客实体的规范化资料字段。 */
export interface NormalizedCustomerFields {
  nickname: string;
  phone: string;
  addresses: CustomerAddressV1[];
}

/** 只有从未关联任何预约的顾客才允许彻底删除。 */
export function assertCustomerCanBeDeleted(
  customerId: string,
  appointments: readonly AppointmentV1[],
): void {
  if (
    appointments.some((appointment) => appointment.customerId === customerId)
  ) {
    throw new CustomerRuleError(
      "referenced-customer",
      "顾客已有预约记录，只能停用",
    );
  }
}

/** 校验并规范化顾客表单；不会生成顾客或地址标识。 */
export function normalizeCustomerInput(
  input: NormalizeCustomerInput,
): NormalizedCustomerFields {
  const nickname = input.nickname.trim();
  if (!nickname) {
    throw new CustomerRuleError("empty-nickname", "请填写顾客昵称");
  }
  if (
    input.existingCustomers.some(
      (customer) =>
        customer.id !== input.editingCustomerId &&
        customer.nickname.trim() === nickname,
    )
  ) {
    throw new CustomerRuleError(
      "duplicate-nickname",
      "已存在相同昵称的顾客",
    );
  }

  const phone = input.phone.trim();
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    throw new CustomerRuleError(
      "invalid-phone",
      "请输入有效的中国大陆 11 位手机号",
    );
  }
  if (
    input.existingCustomers.some(
      (customer) =>
        customer.id !== input.editingCustomerId && customer.phone === phone,
    )
  ) {
    throw new CustomerRuleError(
      "duplicate-phone",
      "该手机号已用于其他顾客",
    );
  }

  const addressIds = new Set<string>();
  const addresses = input.addresses.map((address) => {
    const id = address.id.trim();
    if (!id || addressIds.has(id)) {
      throw new CustomerRuleError(
        "duplicate-address-id",
        "顾客服务地址标识不能为空或重复",
      );
    }
    addressIds.add(id);
    const addressText = address.addressText.trim();
    if (!addressText) {
      throw new CustomerRuleError("empty-address", "请填写服务地址正文");
    }
    const note = address.note?.trim();
    return {
      id,
      addressText,
      ...(note ? { note } : {}),
    };
  });

  return { nickname, phone, addresses };
}
