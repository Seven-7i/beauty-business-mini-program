import type {
  DecimalQuantity,
  InventoryUnitKind,
} from "@/domain/data-schema";

const UNSIGNED_QUANTITY_PATTERN = /^(0|[1-9]\d*)(\.\d{1,2})?$/;
const SIGNED_QUANTITY_PATTERN = /^-?(0|[1-9]\d*)(\.\d{1,2})?$/;

export class DecimalQuantityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecimalQuantityError";
  }
}

/** 把定点数量转换为百分之一单位；业务计算禁止直接使用二进制小数。 */
export function decimalQuantityToHundredths(quantity: DecimalQuantity): number {
  const negative = quantity.startsWith("-");
  const unsigned = negative ? quantity.slice(1) : quantity;
  const [integerPart, decimalPart = ""] = unsigned.split(".");
  const value = Number(integerPart) * 100 + Number(decimalPart.padEnd(2, "0"));
  const signedValue = negative ? -value : value;
  if (!Number.isSafeInteger(signedValue)) {
    throw new DecimalQuantityError("数量超出可安全计算范围");
  }
  return signedValue;
}

/** 把百分之一单位格式化为不带多余末尾零的规范数量字符串。 */
export function hundredthsToDecimalQuantity(value: number): DecimalQuantity {
  if (!Number.isSafeInteger(value)) {
    throw new DecimalQuantityError("数量超出可安全计算范围");
  }
  if (value === 0) {
    return "0";
  }
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  const integerPart = Math.floor(absolute / 100);
  const decimalPart = absolute % 100;
  if (decimalPart === 0) {
    return `${sign}${integerPart}`;
  }
  return `${sign}${integerPart}.${String(decimalPart).padStart(2, "0").replace(/0$/, "")}`;
}

export interface ParseDecimalQuantityOptions {
  unitKind: InventoryUnitKind;
  signed?: boolean;
  positive?: boolean;
}

/** 校验用户输入并返回可持久化的规范定点数量。 */
export function parseDecimalQuantity(
  input: string,
  options: ParseDecimalQuantityOptions,
): DecimalQuantity {
  const value = input.trim();
  const pattern = options.signed
    ? SIGNED_QUANTITY_PATTERN
    : UNSIGNED_QUANTITY_PATTERN;
  if (!pattern.test(value)) {
    throw new DecimalQuantityError("请输入最多两位小数的有效数量");
  }
  if (options.unitKind === "discrete" && value.includes(".")) {
    throw new DecimalQuantityError("离散单位数量必须为整数");
  }
  const hundredths = decimalQuantityToHundredths(value);
  if (options.positive && hundredths <= 0) {
    throw new DecimalQuantityError("数量必须大于零");
  }
  return hundredthsToDecimalQuantity(hundredths);
}

/** 对两个定点数量做精确加法，并校验结果仍处于安全整数范围。 */
export function addDecimalQuantities(
  left: DecimalQuantity,
  right: DecimalQuantity,
): DecimalQuantity {
  const result =
    decimalQuantityToHundredths(left) + decimalQuantityToHundredths(right);
  return hundredthsToDecimalQuantity(result);
}
