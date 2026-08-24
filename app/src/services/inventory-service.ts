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

export interface RewriteManualInventoryMovementOptions {
  /** 当前库存物品。 */
  item: InventoryItemV1;
  /** 该物品的全部历史变动；函数不会修改输入数组。 */
  movements: readonly InventoryMovementV1[];
  /** 全部预约，用于复核重放后的库存下限。 */
  appointments: readonly AppointmentV1[];
  /** 被编辑或删除的手工变动标识。 */
  movementId: string;
  /** 编辑保留记录并替换数量；删除从重放链移除记录。 */
  operation: "edit" | "delete";
  /** 编辑时：补货表示增加量，首次入库/盘点表示调整后的实际量。 */
  quantityInput?: string;
  /** 编辑后的可选说明；空白值会被移除。 */
  note?: string;
  /** 本次编辑实际发生的 ISO 时间，用于更新受影响记录。 */
  updatedAt: string;
}

/**
 * 编辑或删除一条手工变动后按业务时间重放数量链。
 * 补货和预约消耗沿用差额；首次入库与盘点保留其“实际库存”语义。
 */
export function rewriteManualInventoryMovement(
  options: RewriteManualInventoryMovementOptions,
): { item: InventoryItemV1; movements: InventoryMovementV1[] } {
  const ordered = [...options.movements].sort(
    (left, right) =>
      left.occurredAt.localeCompare(right.occurredAt) ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id),
  );
  const target = ordered.find(
    (movement) => movement.id === options.movementId,
  );
  if (!target || target.inventoryItemId !== options.item.id) {
    throw new Error("库存变动记录不存在");
  }
  if (target.type === "appointment-consumption") {
    throw new Error("预约消耗只能通过更正对应预约修改");
  }
  if (options.operation === "edit" && options.quantityInput === undefined) {
    throw new Error("请填写变动数量");
  }

  const retained =
    options.operation === "delete"
      ? ordered.filter((movement) => movement.id !== target.id)
      : ordered;
  // 旧备份可能缺少首次入库记录，从现有链首条起点重放可避免篡改更早历史。
  let currentHundredths = decimalQuantityToHundredths(
    ordered[0]?.beforeQuantity ?? "0",
  );
  const replayed: InventoryMovementV1[] = [];
  for (const movement of retained) {
    const isTarget = movement.id === target.id;
    const beforeQuantity = hundredthsToDecimalQuantity(currentHundredths);
    let afterHundredths: number;
    if (movement.type === "restock" || movement.type === "appointment-consumption") {
      const delta =
        isTarget && options.operation === "edit"
          ? parseDecimalQuantity(options.quantityInput ?? "", {
              unitKind: options.item.unitKind,
              positive: true,
            })
          : movement.deltaQuantity;
      afterHundredths =
        currentHundredths + decimalQuantityToHundredths(delta);
    } else {
      const desiredAfter =
        isTarget && options.operation === "edit"
          ? parseDecimalQuantity(options.quantityInput ?? "", {
              unitKind: options.item.unitKind,
            })
          : movement.afterQuantity;
      afterHundredths = decimalQuantityToHundredths(desiredAfter);
    }
    if (afterHundredths < 0) {
      throw new InventoryRuleError(
        "below-occupied-stock",
        `修改后库存会低于 0${options.item.unit}`,
      );
    }
    const afterQuantity = hundredthsToDecimalQuantity(afterHundredths);
    const deltaQuantity = hundredthsToDecimalQuantity(
      afterHundredths - currentHundredths,
    );
    const rewritten: InventoryMovementV1 = {
      ...movement,
      beforeQuantity,
      deltaQuantity,
      afterQuantity,
      ...(isTarget && options.operation === "edit" && options.note?.trim()
        ? { note: options.note.trim() }
        : {}),
      updatedAt:
        beforeQuantity !== movement.beforeQuantity ||
        deltaQuantity !== movement.deltaQuantity ||
        afterQuantity !== movement.afterQuantity ||
        isTarget
          ? options.updatedAt
          : movement.updatedAt,
    };
    if (isTarget && options.operation === "edit" && !options.note?.trim()) {
      delete rewritten.note;
    }
    replayed.push(rewritten);
    currentHundredths = afterHundredths;
  }

  const occupied = calculateOccupiedQuantity(
    options.item.id,
    options.appointments,
  );
  if (currentHundredths < decimalQuantityToHundredths(occupied)) {
    const shortage = hundredthsToDecimalQuantity(
      decimalQuantityToHundredths(occupied) - currentHundredths,
    );
    throw new InventoryRuleError(
      "below-occupied-stock",
      `修改后库存低于待执行预约占用，缺少 ${shortage}${options.item.unit}`,
    );
  }
  return {
    item: {
      ...options.item,
      currentQuantity: hundredthsToDecimalQuantity(currentHundredths),
      updatedAt: options.updatedAt,
    },
    movements: replayed,
  };
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
