import type { InventoryUnitKind } from "@/domain/data-schema";
import { parseDecimalQuantity } from "@/utils/decimal-quantity";
import type { AppointmentUsageDraft } from "./appointment-form-state";

/** 完成预约弹层在提交前可直接校验的字段输入。 */
export interface AppointmentCompletionValidationInput {
  transactionAmountInput: string;
  completedDate: string;
  completedTime: string;
  actualUsageInputs: readonly AppointmentUsageDraft[];
  inventoryItems: readonly { id: string; unitKind: InventoryUnitKind }[];
}

/** 完成预约弹层按字段展示的校验结果；服务端仍负责最终业务校验。 */
export interface AppointmentCompletionValidationErrors {
  transactionAmount: string;
  completedAt: string;
  usageByInventoryItemId: Record<string, string>;
}

const TRANSACTION_AMOUNT_PATTERN = /^(0|[1-9]\d*)(\.\d{1,2})?$/;
const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME_PATTERN = /^\d{2}:\d{2}$/;

/** 校验完成弹层的本地输入，并返回可贴近字段呈现的错误信息。 */
export function validateAppointmentCompletionInput(
  input: AppointmentCompletionValidationInput,
): AppointmentCompletionValidationErrors {
  const transactionAmount = validateTransactionAmount(input.transactionAmountInput);
  const completedAt = validateCompletedAt(
    input.completedDate,
    input.completedTime,
  );
  const usageByInventoryItemId: Record<string, string> = {};

  for (const usage of input.actualUsageInputs) {
    const inventoryItem = input.inventoryItems.find(
      (item) => item.id === usage.inventoryItemId,
    );
    if (!inventoryItem) {
      continue;
    }
    try {
      parseDecimalQuantity(usage.quantityInput, {
        unitKind: inventoryItem.unitKind,
        positive: true,
      });
    } catch (error) {
      usageByInventoryItemId[usage.inventoryItemId] =
        error instanceof Error ? error.message : "请输入有效的实际用量";
    }
  }

  return { transactionAmount, completedAt, usageByInventoryItemId };
}

/** 保持与预约服务一致的成交金额格式，避免无效请求才显示笼统错误。 */
function validateTransactionAmount(input: string): string {
  const value = input.trim();
  if (!TRANSACTION_AMOUNT_PATTERN.test(value)) {
    return "请输入大于等于零、最多两位小数的金额";
  }
  const [yuan, fraction = ""] = value.split(".");
  const cents = Number(yuan) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? "" : "成交金额超出可保存范围";
}

/** 校验原生日期和时间选择器回传的组合值，避免无效时间提交到服务层。 */
function validateCompletedAt(dateInput: string, timeInput: string): string {
  if (!LOCAL_DATE_PATTERN.test(dateInput) || !LOCAL_TIME_PATTERN.test(timeInput)) {
    return "请选择有效的实际完成时间";
  }
  const completedAt = new Date(`${dateInput}T${timeInput}:00`);
  const [year, month, day] = dateInput.split("-").map(Number);
  const [hour, minute] = timeInput.split(":").map(Number);
  const isExactLocalTime =
    completedAt.getFullYear() === year &&
    completedAt.getMonth() === month - 1 &&
    completedAt.getDate() === day &&
    completedAt.getHours() === hour &&
    completedAt.getMinutes() === minute;
  return Number.isNaN(completedAt.getTime()) || !isExactLocalTime
    ? "请选择有效的实际完成时间"
    : "";
}
