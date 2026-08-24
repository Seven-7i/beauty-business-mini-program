import type {
  ApplicationData,
  InventoryItemV1,
  InventoryUnitKind,
} from "@/domain/data-schema";
import type { ApplicationDataRepository } from "@/repositories/application-data-repository";
import {
  assertUniqueInventoryIdentity,
  assertInventoryItemUnitCanBeChanged,
  assertInventoryItemCanBeDeleted,
  calculateOccupiedQuantity,
  createInventoryAdjustment,
  rewriteManualInventoryMovement,
} from "./inventory-service";
import { parseDecimalQuantity } from "@/utils/decimal-quantity";

/** 库存用例只需要快照读取与封闭业务命令提交。 */
export type InventoryManagementRepository = Pick<
  ApplicationDataRepository,
  "readSnapshot" | "applyBusinessMutation"
>;

export interface InventoryManagementServiceOptions {
  repository: InventoryManagementRepository;
  /** 注入时钟保证物品与首次入库记录使用同一业务时间。 */
  now?: () => Date;
  /** 注入稳定标识生成器；生产默认生成带时间和随机段的本机标识。 */
  createId?: (kind: "inventory-item" | "inventory-movement") => string;
}

export interface CreateInventoryItemInput {
  /** 启用物品中与单位组合后唯一的名称。 */
  name: string;
  /** 展示和数量错误提示使用的计量单位。 */
  unit: string;
  /** 决定数量是否允许最多两位小数。 */
  unitKind: InventoryUnitKind;
  /** 创建时的实际持有数量，允许为零。 */
  initialQuantityInput: string;
  /** 可选规格、品牌或存放位置说明。 */
  note?: string;
}

export interface AdjustInventoryInput {
  /** 被调整物品的稳定标识。 */
  inventoryItemId: string;
  /** 补货输入增加量，盘点输入调整后的实际量。 */
  kind: "restock" | "stocktake";
  /** 尚未规范化的用户数量输入。 */
  quantityInput: string;
  /** 可选到货批次或盘点原因。 */
  note?: string;
}

export interface UpdateInventoryItemProfileInput {
  /** 被编辑物品的稳定标识。 */
  inventoryItemId: string;
  /** 新名称；保存时去除首尾空白。 */
  name: string;
  /** 新计量单位；不改变原有数量精度规则。 */
  unit: string;
  /** 可选资料说明，空白值会被移除。 */
  note?: string;
}

export interface RewriteManualInventoryMovementInput {
  /** 被编辑或删除的手工变动标识。 */
  movementId: string;
  /** 编辑会保留记录，删除会移除记录并重放后续链。 */
  operation: "edit" | "delete";
  /** 编辑时按记录类型表示补货增加量或盘点后的实际库存。 */
  quantityInput?: string;
  /** 编辑后的可选说明。 */
  note?: string;
}

function defaultCreateId(
  kind: "inventory-item" | "inventory-movement",
): string {
  return `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 提供库存页面所需的高层用例；调用方不需要理解变动记录、占用汇总或事务组合。
 */
export function createInventoryManagementService(
  options: InventoryManagementServiceOptions,
) {
  const {
    repository,
    now = () => new Date(),
    createId = defaultCreateId,
  } = options;

  async function readData(): Promise<ApplicationData> {
    return repository.readSnapshot();
  }

  async function createInventoryItem(
    input: CreateInventoryItemInput,
  ): Promise<InventoryItemV1> {
    const data = await readData();
    const name = input.name.trim();
    const unit = input.unit.trim();
    if (!name || !unit) {
      throw new Error("请填写库存物品名称和计量单位");
    }
    assertUniqueInventoryIdentity(name, unit, data.inventoryItems);
    const currentQuantity = parseDecimalQuantity(
      input.initialQuantityInput,
      { unitKind: input.unitKind },
    );
    const occurredAt = now().toISOString();
    const itemId = createId("inventory-item");
    const movementId = createId("inventory-movement");
    if (data.inventoryItems.some((item) => item.id === itemId)) {
      throw new Error("库存物品标识冲突，请重试");
    }
    if (data.inventoryMovements.some((movement) => movement.id === movementId)) {
      throw new Error("库存变动标识冲突，请重试");
    }
    const item: InventoryItemV1 = {
      id: itemId,
      name,
      unit,
      unitKind: input.unitKind,
      currentQuantity,
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      status: "active",
      createdAt: occurredAt,
      updatedAt: occurredAt,
      schemaVersion: 1,
    };
    await repository.applyBusinessMutation({
      kind: "commit-inventory-adjustment",
      item,
      movement: {
        id: movementId,
        inventoryItemId: item.id,
        type: "initial",
        beforeQuantity: "0",
        deltaQuantity: currentQuantity,
        afterQuantity: currentQuantity,
        occurredAt,
        appointmentDeleted: false,
        createdAt: occurredAt,
        updatedAt: occurredAt,
        schemaVersion: 1,
      },
    });
    return item;
  }

  async function adjustInventory(
    input: AdjustInventoryInput,
  ): Promise<InventoryItemV1> {
    const data = await readData();
    const item = data.inventoryItems.find(
      (candidate) => candidate.id === input.inventoryItemId,
    );
    if (!item) {
      throw new Error("库存物品不存在");
    }
    const occurredAt = now().toISOString();
    const result = createInventoryAdjustment({
      item,
      kind: input.kind,
      quantityInput: input.quantityInput,
      occupiedQuantity: calculateOccupiedQuantity(
        item.id,
        data.appointments,
      ),
      movementId: createId("inventory-movement"),
      occurredAt,
      note: input.note,
    });
    await repository.applyBusinessMutation({
      kind: "commit-inventory-adjustment",
      ...result,
    });
    return result.item;
  }

  async function updateInventoryItemProfile(
    input: UpdateInventoryItemProfileInput,
  ): Promise<InventoryItemV1> {
    const data = await readData();
    const current = data.inventoryItems.find(
      (item) => item.id === input.inventoryItemId,
    );
    if (!current) {
      throw new Error("库存物品不存在");
    }
    const name = input.name.trim();
    const unit = input.unit.trim();
    if (!name || !unit) {
      throw new Error("请填写库存物品名称和计量单位");
    }
    if (current.status === "active") {
      assertUniqueInventoryIdentity(
        name,
        unit,
        data.inventoryItems,
        current.id,
      );
    }
    if (unit !== current.unit) {
      assertInventoryItemUnitCanBeChanged(
        current.id,
        data.projects,
        data.appointments,
        data.inventoryMovements,
      );
    }
    const updated: InventoryItemV1 = {
      ...current,
      name,
      unit,
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      updatedAt: now().toISOString(),
    };
    if (!input.note?.trim()) {
      delete updated.note;
    }
    await repository.applyBusinessMutation({
      kind: "upsert-inventory-item",
      item: updated,
      expectedUpdatedAt: current.updatedAt,
    });
    return updated;
  }

  async function setInventoryItemStatus(
    inventoryItemId: string,
    status: InventoryItemV1["status"],
  ): Promise<InventoryItemV1> {
    const data = await readData();
    const current = data.inventoryItems.find(
      (item) => item.id === inventoryItemId,
    );
    if (!current) {
      throw new Error("库存物品不存在");
    }
    if (status === "active") {
      assertUniqueInventoryIdentity(
        current.name,
        current.unit,
        data.inventoryItems,
        current.id,
      );
    }
    const updated: InventoryItemV1 = {
      ...current,
      status,
      updatedAt: now().toISOString(),
    };
    await repository.applyBusinessMutation({
      kind: "upsert-inventory-item",
      item: updated,
      expectedUpdatedAt: current.updatedAt,
    });
    return updated;
  }

  async function deleteInventoryItem(inventoryItemId: string): Promise<void> {
    const data = await readData();
    if (!data.inventoryItems.some((item) => item.id === inventoryItemId)) {
      throw new Error("库存物品不存在");
    }
    assertInventoryItemCanBeDeleted(
      inventoryItemId,
      data.projects,
      data.appointments,
      data.inventoryMovements,
    );
    await repository.applyBusinessMutation({
      kind: "delete-unreferenced-inventory-item",
      inventoryItemId,
    });
  }

  async function rewriteManualMovement(
    input: RewriteManualInventoryMovementInput,
  ): Promise<InventoryItemV1> {
    const data = await readData();
    const movement = data.inventoryMovements.find(
      (candidate) => candidate.id === input.movementId,
    );
    if (!movement) {
      throw new Error("库存变动记录不存在");
    }
    const item = data.inventoryItems.find(
      (candidate) => candidate.id === movement.inventoryItemId,
    );
    if (!item) {
      throw new Error("库存物品不存在");
    }
    const result = rewriteManualInventoryMovement({
      item,
      movements: data.inventoryMovements.filter(
        (candidate) => candidate.inventoryItemId === item.id,
      ),
      appointments: data.appointments,
      ...input,
      updatedAt: now().toISOString(),
    });
    await repository.applyBusinessMutation({
      kind: "rewrite-manual-inventory-movements",
      item: result.item,
      movements: result.movements,
      expectedMovements: data.inventoryMovements
        .filter((movement) => movement.inventoryItemId === result.item.id)
        .map(({ id, updatedAt }) => ({ id, updatedAt })),
    });
    return result.item;
  }

  return {
    readData,
    createInventoryItem,
    adjustInventory,
    updateInventoryItemProfile,
    setInventoryItemStatus,
    deleteInventoryItem,
    rewriteManualMovement,
  };
}

export type InventoryManagementService = ReturnType<
  typeof createInventoryManagementService
>;
