import { computed, readonly, shallowRef } from "vue";
import type {
  AppointmentV1,
  BeautyProjectV1,
  InventoryItemV1,
  InventoryMovementV1,
} from "@/domain/data-schema";
import type {
  AdjustInventoryInput,
  CreateInventoryItemInput,
  InventoryManagementService,
  UpdateInventoryItemProfileInput,
} from "@/services/inventory-management-service";
import {
  calculateAvailableQuantity,
  calculateOccupiedQuantity,
  isInventoryItemUnitLocked,
} from "@/services/inventory-service";

export interface UseInventoryManagementOptions {
  service: InventoryManagementService;
}

export interface InventoryItemStockSummary {
  item: InventoryItemV1;
  /** 全部待执行预约已经承诺的数量。 */
  occupiedQuantity: string;
  /** 当前实际库存扣除预约占用后，可用于新预约的数量。 */
  availableQuantity: string;
}

/** 物品详情的两个稳定内容区。 */
export type InventoryItemDetailTab = "profile" | "activity";

/** 库存列表筛选所需的最小库存物品形状。 */
interface FilterableInventoryItem {
  item: Pick<InventoryItemV1, "name" | "status">;
}

/**
 * 按确认稿在互斥的启用/停用范围内匹配库存物品名称。
 * 当前由 InventoryItemList 调用；放在稳定装载的库存 composable 模块中，避免微信主包遗漏独立纯 TS 模块。
 */
export function filterInventoryItems<TSummary extends FilterableInventoryItem>(
  summaries: readonly TSummary[],
  keyword: string,
  inactiveOnly: boolean,
): TSummary[] {
  const query = keyword.trim();
  const visibleStatus: InventoryItemV1["status"] = inactiveOnly
    ? "inactive"
    : "active";

  return summaries.filter(
    ({ item }) =>
      item.status === visibleStatus && (!query || item.name.includes(query)),
  );
}

/**
 * 从统一库存流水中筛出一个物品的动态并按发生时间倒序排列。
 * 当前由物品详情页使用；保留统一记录源，未来可直接汇总为全局流水。
 */
export function filterInventoryMovementsForItem(
  movements: readonly InventoryMovementV1[],
  inventoryItemId: string,
): InventoryMovementV1[] {
  return movements
    .filter((movement) => movement.inventoryItemId === inventoryItemId)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}

/** 编排库存页异步状态；组件只发出用户意图，不直接访问 repository。 */
export function useInventoryManagement(
  options: UseInventoryManagementOptions,
) {
  const items = shallowRef<InventoryItemV1[]>([]);
  const movements = shallowRef<InventoryMovementV1[]>([]);
  const appointments = shallowRef<AppointmentV1[]>([]);
  const projects = shallowRef<BeautyProjectV1[]>([]);
  const loading = shallowRef(false);
  const submitting = shallowRef(false);
  const errorMessage = shallowRef("");
  const errorKind = shallowRef<"" | "read" | "operation">("");
  const activeItems = computed(() =>
    items.value.filter((item) => item.status === "active"),
  );
  const itemSummaries = computed<InventoryItemStockSummary[]>(() =>
    [...items.value]
      .sort((left, right) => {
        if (left.status !== right.status) {
          return left.status === "active" ? -1 : 1;
        }
        return left.name.localeCompare(right.name);
      })
      .map((item) => ({
        item,
        occupiedQuantity: calculateOccupiedQuantity(item.id, appointments.value),
        availableQuantity: calculateAvailableQuantity(item, appointments.value),
      })),
  );
  const movementsByRecency = computed(() =>
    [...movements.value]
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)),
  );
  const unitLockedItemIds = computed(() =>
    new Set(
      items.value
        .filter((item) =>
          isInventoryItemUnitLocked(
            item.id,
            projects.value,
            appointments.value,
            movements.value,
          ),
        )
        .map((item) => item.id),
    ),
  );

  async function refresh(): Promise<void> {
    loading.value = true;
    errorMessage.value = "";
    errorKind.value = "";
    try {
      const data = await options.service.readData();
      items.value = data.inventoryItems;
      movements.value = data.inventoryMovements;
      appointments.value = data.appointments;
      projects.value = data.projects;
    } catch {
      errorKind.value = "read";
      errorMessage.value = "库存读取失败，为避免覆盖原数据，请返回后重试";
    } finally {
      loading.value = false;
    }
  }

  async function runMutation(operation: () => Promise<unknown>): Promise<boolean> {
    submitting.value = true;
    errorMessage.value = "";
    errorKind.value = "";
    try {
      await operation();
      await refresh();
      return true;
    } catch (error) {
      errorKind.value = "operation";
      errorMessage.value =
        error instanceof Error ? error.message : "库存保存失败，请稍后重试";
      return false;
    } finally {
      submitting.value = false;
    }
  }

  async function createItem(
    input: CreateInventoryItemInput,
  ): Promise<InventoryItemV1 | undefined> {
    let created: InventoryItemV1 | undefined;
    const saved = await runMutation(async () => {
      created = await options.service.createInventoryItem(input);
    });
    return saved ? created : undefined;
  }

  function adjustInventory(input: AdjustInventoryInput): Promise<boolean> {
    return runMutation(() => options.service.adjustInventory(input));
  }

  function updateItemProfile(
    input: UpdateInventoryItemProfileInput,
  ): Promise<boolean> {
    return runMutation(() =>
      options.service.updateInventoryItemProfile(input),
    );
  }

  function setItemStatus(
    inventoryItemId: string,
    status: InventoryItemV1["status"],
  ): Promise<boolean> {
    return runMutation(() =>
      options.service.setInventoryItemStatus(inventoryItemId, status),
    );
  }

  function deleteItem(inventoryItemId: string): Promise<boolean> {
    return runMutation(() =>
      options.service.deleteInventoryItem(inventoryItemId),
    );
  }

  return {
    items: readonly(items),
    activeItems,
    itemSummaries,
    movementsByRecency,
    unitLockedItemIds,
    loading: readonly(loading),
    submitting: readonly(submitting),
    errorMessage: readonly(errorMessage),
    errorKind: readonly(errorKind),
    refresh,
    createItem,
    adjustInventory,
    updateItemProfile,
    setItemStatus,
    deleteItem,
  };
}
