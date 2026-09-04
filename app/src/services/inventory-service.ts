import type {
  AppointmentV1,
  BeautyProjectV1,
  DecimalQuantity,
  InventoryItemV1,
  InventoryMovementV1,
} from "@/domain/data-schema";
import {
  addDecimalQuantities,
  decimalQuantityToHundredths,
  hundredthsToDecimalQuantity,
  parseDecimalQuantity,
} from "@/utils/decimal-quantity";

export class InventoryRuleError extends Error {
  constructor(
    readonly code:
      | "duplicate-identity"
      | "below-occupied-stock"
      | "referenced-item",
    message: string,
  ) {
    super(message);
    this.name = "InventoryRuleError";
  }
}

function isInventoryItemReferenced(
  inventoryItemId: string,
  projects: readonly BeautyProjectV1[],
  appointments: readonly AppointmentV1[],
): boolean {
  return (
    projects.some((project) =>
      project.defaultUsages.some(
        (usage) => usage.inventoryItemId === inventoryItemId,
      ),
    ) ||
    appointments.some((appointment) =>
      appointment.actualUsages.some(
        (usage) => usage.inventoryItemId === inventoryItemId,
      ),
    )
  );
}

/**
 * 判断物品的计量单位是否已被项目、预约或历史预约消耗锁定。
 * 当前由库存资料编辑页和库存 service 校验共同调用，确保界面提示与提交规则一致。
 */
export function isInventoryItemUnitLocked(
  inventoryItemId: string,
  projects: readonly BeautyProjectV1[],
  appointments: readonly AppointmentV1[],
  movements: readonly InventoryMovementV1[] = [],
): boolean {
  return (
    isInventoryItemReferenced(inventoryItemId, projects, appointments) ||
    movements.some(
      (movement) =>
        movement.inventoryItemId === inventoryItemId &&
        movement.type === "appointment-consumption",
    )
  );
}

/** 被项目或任意历史预约引用的库存物品只能停用，不能彻底删除。 */
export function assertInventoryItemCanBeDeleted(
  inventoryItemId: string,
  projects: readonly BeautyProjectV1[],
  appointments: readonly AppointmentV1[],
  movements: readonly InventoryMovementV1[] = [],
): void {
  const hasAppointmentConsumption = movements.some(
    (movement) =>
      movement.inventoryItemId === inventoryItemId &&
      movement.type === "appointment-consumption",
  );
  if (
    isInventoryItemReferenced(inventoryItemId, projects, appointments) ||
    hasAppointmentConsumption
  ) {
    throw new InventoryRuleError(
      "referenced-item",
      "库存物品已有项目或预约引用，只能停用",
    );
  }
}

/** 已进入项目或预约用量口径的物品不得改单位，避免历史数量失去含义。 */
export function assertInventoryItemUnitCanBeChanged(
  inventoryItemId: string,
  projects: readonly BeautyProjectV1[],
  appointments: readonly AppointmentV1[],
  movements: readonly InventoryMovementV1[] = [],
): void {
  if (
    isInventoryItemUnitLocked(
      inventoryItemId,
      projects,
      appointments,
      movements,
    )
  ) {
    throw new InventoryRuleError(
      "referenced-item",
      "库存物品已有项目或预约引用，不能修改计量单位；请停用后新建",
    );
  }
}

/** 汇总待执行预约占用；编辑预约时可排除自身，避免把原用量重复计算。 */
export function calculateOccupiedQuantity(
  inventoryItemId: string,
  appointments: readonly AppointmentV1[],
  excludedAppointmentId?: string,
): DecimalQuantity {
  let occupiedHundredths = 0;
  for (const appointment of appointments) {
    if (
      appointment.status !== "pending" ||
      appointment.id === excludedAppointmentId
    ) {
      continue;
    }
    for (const usage of appointment.actualUsages) {
      if (usage.inventoryItemId === inventoryItemId) {
        occupiedHundredths += decimalQuantityToHundredths(usage.quantity);
        if (!Number.isSafeInteger(occupiedHundredths)) {
          throw new Error("预约占用数量超出可安全计算范围");
        }
      }
    }
  }
  return hundredthsToDecimalQuantity(occupiedHundredths);
}

/** 当前库存减去其他待执行预约占用，得到新业务可使用的库存。 */
export function calculateAvailableQuantity(
  item: InventoryItemV1,
  appointments: readonly AppointmentV1[],
  excludedAppointmentId?: string,
): DecimalQuantity {
  const occupied = calculateOccupiedQuantity(
    item.id,
    appointments,
    excludedAppointmentId,
  );
  return hundredthsToDecimalQuantity(
    decimalQuantityToHundredths(item.currentQuantity) -
      decimalQuantityToHundredths(occupied),
  );
}

/** 启用库存物品以去除首尾空白后的“名称 + 单位”作为唯一标识。 */
export function assertUniqueInventoryIdentity(
  name: string,
  unit: string,
  items: readonly InventoryItemV1[],
  editingItemId?: string,
): void {
  const normalizedName = name.trim();
  const normalizedUnit = unit.trim();
  const duplicate = items.some(
    (item) =>
      item.status === "active" &&
      item.id !== editingItemId &&
      item.name.trim() === normalizedName &&
      item.unit.trim() === normalizedUnit,
  );
  if (duplicate) {
    throw new InventoryRuleError(
      "duplicate-identity",
      "已存在相同名称和单位的启用库存物品",
    );
  }
}

export interface CreateInventoryAdjustmentOptions {
  /** 调整前的库存物品。 */
  item: InventoryItemV1;
  /** 补货填写增加量；盘点填写调整后的实际量。 */
  kind: "restock" | "stocktake";
  /** 补货时表示本次增加量，盘点时表示盘点后的实际库存。 */
  quantityInput: string;
  /** 其他待执行预约已占用的总量。 */
  occupiedQuantity: DecimalQuantity;
  /** 为本次库存事实预先生成的稳定标识。 */
  movementId: string;
  /** 本次业务操作实际发生的 ISO 时间。 */
  occurredAt: string;
  /** 可选手工说明；空白内容不会持久化。 */
  note?: string;
}

/** 生成补货或盘点修正结果；调用方应在一个仓储事务中同时保存物品和变动。 */
export function createInventoryAdjustment(
  options: CreateInventoryAdjustmentOptions,
): { item: InventoryItemV1; movement: InventoryMovementV1 } {
  const { item, kind, occupiedQuantity, movementId, occurredAt } = options;
  const parsed = parseDecimalQuantity(options.quantityInput, {
    unitKind: item.unitKind,
    positive: kind === "restock",
  });
  const afterQuantity =
    kind === "restock"
      ? addDecimalQuantities(item.currentQuantity, parsed)
      : parsed;
  if (
    decimalQuantityToHundredths(afterQuantity) <
    decimalQuantityToHundredths(occupiedQuantity)
  ) {
    const shortage = hundredthsToDecimalQuantity(
      decimalQuantityToHundredths(occupiedQuantity) -
        decimalQuantityToHundredths(afterQuantity),
    );
    throw new InventoryRuleError(
      "below-occupied-stock",
      `盘点后库存低于待执行预约占用，缺少 ${shortage}${item.unit}`,
    );
  }
  const deltaQuantity = hundredthsToDecimalQuantity(
    decimalQuantityToHundredths(afterQuantity) -
      decimalQuantityToHundredths(item.currentQuantity),
  );
  const updatedItem: InventoryItemV1 = {
    ...item,
    currentQuantity: afterQuantity,
    updatedAt: occurredAt,
  };
  const movement: InventoryMovementV1 = {
    id: movementId,
    inventoryItemId: item.id,
    type: kind,
    beforeQuantity: item.currentQuantity,
    deltaQuantity,
    afterQuantity,
    ...(options.note?.trim() ? { note: options.note.trim() } : {}),
    occurredAt,
    appointmentDeleted: false,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    schemaVersion: 1,
  };
  return { item: updatedItem, movement };
}
