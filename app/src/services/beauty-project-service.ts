import type {
  AppointmentV1,
  BeautyProjectV1,
  InventoryItemV1,
  ProjectDefaultUsageV1,
} from "@/domain/data-schema";
import { parseDecimalQuantity } from "@/utils/decimal-quantity";

export type BeautyProjectRuleErrorCode =
  | "empty-name"
  | "duplicate-name"
  | "invalid-price"
  | "invalid-duration"
  | "duplicate-usage"
  | "unavailable-inventory-item"
  | "referenced-project";

export class BeautyProjectRuleError extends Error {
  constructor(
    readonly code: BeautyProjectRuleErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BeautyProjectRuleError";
  }
}

/** 被任意历史预约快照引用的服务项目只能停用，不能彻底删除。 */
export function assertBeautyProjectCanBeDeleted(
  projectId: string,
  appointments: readonly AppointmentV1[],
): void {
  if (
    appointments.some((appointment) =>
      appointment.projectSnapshots.some(
        (snapshot) => snapshot.projectId === projectId,
      ),
    )
  ) {
    throw new BeautyProjectRuleError(
      "referenced-project",
      "服务项目已有预约引用，只能停用",
    );
  }
}

export interface ProjectDefaultUsageInput {
  /** 被配置建议用量的库存物品标识。 */
  inventoryItemId: string;
  /** 尚未规范化的用户数量输入。 */
  quantityInput: string;
}

export interface NormalizeBeautyProjectInput {
  /** 服务项目名称，保存时去除首尾空白。 */
  name: string;
  /** 以人民币元输入的标准价格。 */
  standardPriceInput: string;
  /** 以分钟输入的预计服务时长。 */
  durationMinutesInput: string;
  /** 可以为空的项目默认用量草稿。 */
  defaultUsages: readonly ProjectDefaultUsageInput[];
  /** 用于校验默认用量引用和单位精度的库存物品。 */
  inventoryItems: readonly InventoryItemV1[];
  /** 用于校验启用项目名称唯一性的现有项目。 */
  existingProjects: readonly BeautyProjectV1[];
  /** 编辑项目时排除自身的稳定标识。 */
  editingProjectId?: string;
  /** 停用项目编辑历史资料时不占用启用名称，也允许引用已停用物品。 */
  targetStatus?: BeautyProjectV1["status"];
}

export interface NormalizedBeautyProjectFields {
  /** 去除首尾空白后的项目名称。 */
  name: string;
  /** 转换为人民币分的标准价格。 */
  standardPriceCents: number;
  /** 大于零的整数分钟数。 */
  durationMinutes: number;
  /** 已校验引用、去重并规范化数量的默认用量。 */
  defaultUsages: ProjectDefaultUsageV1[];
}

function parsePriceCents(input: string): number {
  const value = input.trim();
  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value)) {
    throw new BeautyProjectRuleError(
      "invalid-price",
      "标准价格必须为大于等于零、最多两位小数的金额",
    );
  }
  const [yuan, fraction = ""] = value.split(".");
  const cents = Number(yuan) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) {
    throw new BeautyProjectRuleError("invalid-price", "标准价格超出可保存范围");
  }
  return cents;
}

/** 校验并规范化服务项目表单；默认用量不会在此占用或扣减库存。 */
export function normalizeBeautyProjectInput(
  input: NormalizeBeautyProjectInput,
): NormalizedBeautyProjectFields {
  const name = input.name.trim();
  if (!name) {
    throw new BeautyProjectRuleError("empty-name", "请填写项目名称");
  }
  const targetStatus = input.targetStatus ?? "active";
  if (
    targetStatus === "active" &&
    input.existingProjects.some(
      (project) =>
        project.status === "active" &&
        project.id !== input.editingProjectId &&
        project.name.trim() === name,
    )
  ) {
    throw new BeautyProjectRuleError(
      "duplicate-name",
      "已存在同名的启用服务项目",
    );
  }

  if (!/^[1-9]\d*$/.test(input.durationMinutesInput.trim())) {
    throw new BeautyProjectRuleError(
      "invalid-duration",
      "预计服务时长必须为大于零的整数分钟",
    );
  }
  const durationMinutes = Number(input.durationMinutesInput.trim());
  if (!Number.isSafeInteger(durationMinutes)) {
    throw new BeautyProjectRuleError(
      "invalid-duration",
      "预计服务时长超出可保存范围",
    );
  }

  const seenItemIds = new Set<string>();
  const defaultUsages = input.defaultUsages.map((usage) => {
    if (seenItemIds.has(usage.inventoryItemId)) {
      throw new BeautyProjectRuleError(
        "duplicate-usage",
        "同一库存物品不能重复配置默认用量",
      );
    }
    seenItemIds.add(usage.inventoryItemId);
    const item = input.inventoryItems.find(
      (candidate) =>
        candidate.id === usage.inventoryItemId &&
        (targetStatus === "inactive" || candidate.status === "active"),
    );
    if (!item) {
      throw new BeautyProjectRuleError(
        "unavailable-inventory-item",
        "默认用量引用的库存物品不存在或已停用",
      );
    }
    return {
      inventoryItemId: item.id,
      quantity: parseDecimalQuantity(usage.quantityInput, {
        unitKind: item.unitKind,
        positive: true,
      }),
    };
  });

  return {
    name,
    standardPriceCents: parsePriceCents(input.standardPriceInput),
    durationMinutes,
    defaultUsages,
  };
}
