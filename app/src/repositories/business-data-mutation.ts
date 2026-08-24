import type {
  ApplicationData,
  AppointmentUsageV1,
  BeautyProjectV1,
  CustomerV1,
  IsoDateTimeString,
  InventoryItemV1,
  InventoryMovementV1,
  PendingAppointmentV1,
} from "@/domain/data-schema";
import { migrateApplicationData } from "@/services/data-migrations";
import {
  decimalQuantityToHundredths,
  hundredthsToDecimalQuantity,
  parseDecimalQuantity,
} from "@/utils/decimal-quantity";

/** repository 对外允许提交的封闭日常业务变更；新增种类必须补事务故障测试。 */
export type BusinessDataMutation =
  | {
      /** 新增库存物品或保存不改变库存事实的物品资料。 */
      kind: "upsert-inventory-item";
      item: InventoryItemV1;
      /** 新增时省略；更新时必须等于读取资料时的版本，防止资料/状态互相覆盖。 */
      expectedUpdatedAt?: IsoDateTimeString;
    }
  | {
      /** 必须把库存数量变化和对应事实记录作为一个原子组合提交。 */
      kind: "commit-inventory-adjustment";
      item: InventoryItemV1;
      movement: InventoryMovementV1;
    }
  | {
      /** 新增或保存已经完成默认用量校验的服务项目。 */
      kind: "upsert-beauty-project";
      project: BeautyProjectV1;
      /** 新增时省略；更新时保护资料与状态并发写。 */
      expectedUpdatedAt?: IsoDateTimeString;
    }
  | {
      /** 新增或保存已经完成唯一性、手机号与地址校验的顾客。 */
      kind: "upsert-customer";
      customer: CustomerV1;
      /** 新增时省略；更新时保护资料与状态并发写。 */
      expectedUpdatedAt?: IsoDateTimeString;
    }
  | {
      /** 删除从未被项目、预约或预约消耗记录引用的物品及其手工变动。 */
      kind: "delete-unreferenced-inventory-item";
      inventoryItemId: string;
    }
  | {
      /** 删除从未进入预约快照的服务项目。 */
      kind: "delete-unreferenced-beauty-project";
      projectId: string;
    }
  | {
      /** 删除从未关联任何状态预约的顾客。 */
      kind: "delete-unreferenced-customer";
      customerId: string;
    }
  | {
      /** 原子保存手工记录编辑/删除后重放得到的物品和完整变动链。 */
      kind: "rewrite-manual-inventory-movements";
      item: InventoryItemV1;
      movements: readonly InventoryMovementV1[];
      /** 用例读取时该物品的完整变动版本集合，任何并发变化都会拒绝重放。 */
      expectedMovements: readonly {
        id: string;
        updatedAt: IsoDateTimeString;
      }[];
    }
  | {
      /** 新增或编辑仍处于待执行状态的预约；库存只占用，不在此扣减。 */
      kind: "upsert-pending-appointment";
      appointment: PendingAppointmentV1;
      /** 编辑时保护预约本身；新增时省略。 */
      expectedUpdatedAt?: IsoDateTimeString;
      /** 保护保存预约时依赖的顾客、项目与库存资料快照。 */
      expectedReferences: {
        customerUpdatedAt: IsoDateTimeString;
        projects: readonly { id: string; updatedAt: IsoDateTimeString }[];
        inventoryItems: readonly { id: string; updatedAt: IsoDateTimeString }[];
      };
    }
  | {
      /** 取消真实发生的待执行预约；只释放派生占用，不产生库存变动。 */
      kind: "cancel-pending-appointment";
      appointmentId: string;
      expectedUpdatedAt: IsoDateTimeString;
      cancelledAt: IsoDateTimeString;
      cancelReason?: string;
      updatedAt: IsoDateTimeString;
    }
  | {
      /** 把误取消预约恢复为待执行；提交时必须按最新库存重新取得占用。 */
      kind: "restore-cancelled-appointment";
      appointmentId: string;
      expectedUpdatedAt: IsoDateTimeString;
      updatedAt: IsoDateTimeString;
    }
  | {
      /** 原子完成预约、扣减库存并为每项实际用量生成一条预约消耗。 */
      kind: "complete-pending-appointment";
      appointmentId: string;
      expectedUpdatedAt: IsoDateTimeString;
      actualUsages: readonly AppointmentUsageV1[];
      transactionAmountCents: number;
      completedAt: IsoDateTimeString;
      note?: string;
      updatedAt: IsoDateTimeString;
      /** 每项实际用量对应一个预生成的稳定变动标识。 */
      movementIds: readonly {
        inventoryItemId: string;
        movementId: string;
      }[];
    }
  | {
      /** 原子更正已完成预约的成交信息、完成时间和预约消耗。 */
      kind: "correct-completed-appointment";
      appointmentId: string;
      expectedUpdatedAt: IsoDateTimeString;
      actualUsages: readonly AppointmentUsageV1[];
      transactionAmountCents: number;
      completedAt: IsoDateTimeString;
      note?: string;
      updatedAt: IsoDateTimeString;
      /** 原物品继续复用旧消耗标识；新物品使用新标识，禁止把旧标识移给其他物品。 */
      movementIds: readonly {
        inventoryItemId: string;
        movementId: string;
      }[];
    }
  | {
      /** 撤销误完成预约，移除其消耗并恢复为待执行占用。 */
      kind: "revert-completed-appointment";
      appointmentId: string;
      expectedUpdatedAt: IsoDateTimeString;
      updatedAt: IsoDateTimeString;
    }
  | {
      /** 按当前状态彻底删除预约；已完成预约的消耗事实必须继续保留。 */
      kind: "delete-appointment";
      appointmentId: string;
      expectedStatus: "pending" | "completed" | "cancelled";
      expectedUpdatedAt: IsoDateTimeString;
      updatedAt: IsoDateTimeString;
    };

function upsertById<T extends { id: string }>(
  records: readonly T[],
  record: T,
): T[] {
  const index = records.findIndex((candidate) => candidate.id === record.id);
  if (index < 0) {
    return [...records, record];
  }
  return records.map((candidate, position) =>
    position === index ? record : candidate,
  );
}

function advanceUpdatedAt(
  previousUpdatedAt: IsoDateTimeString,
  requestedUpdatedAt: IsoDateTimeString,
  committedAt: IsoDateTimeString,
): IsoDateTimeString {
  const previousTime = new Date(previousUpdatedAt).getTime();
  const requestedTime = new Date(requestedUpdatedAt).getTime();
  const committedTime = new Date(committedAt).getTime();
  return new Date(
    Math.max(previousTime + 1, requestedTime, committedTime),
  ).toISOString();
}

/** 基于命令队列内最新预约汇总占用，禁止旧快照盘点绕过库存下限。 */
function pendingOccupiedHundredths(
  data: ApplicationData,
  inventoryItemId: string,
  excludingAppointmentId?: string,
): number {
  let occupied = 0;
  for (const appointment of data.appointments) {
    if (
      appointment.status !== "pending" ||
      appointment.id === excludingAppointmentId
    ) {
      continue;
    }
    for (const usage of appointment.actualUsages) {
      if (usage.inventoryItemId === inventoryItemId) {
        occupied += decimalQuantityToHundredths(usage.quantity);
        if (!Number.isSafeInteger(occupied)) {
          throw new Error("预约占用数量超出可安全计算范围");
        }
      }
    }
  }
  return occupied;
}

interface InsertAppointmentConsumptionOptions {
  item: InventoryItemV1;
  movements: readonly InventoryMovementV1[];
  movementId: string;
  appointmentId: string;
  usage: AppointmentUsageV1;
  occurredAt: IsoDateTimeString;
  committedAt: IsoDateTimeString;
}

/**
 * 按业务时间插入预约消耗并重放后续库存链。
 * 补货/消耗保留差额，首次入库和盘点保留当时确认的实际库存。
 */
function insertAppointmentConsumption(
  options: InsertAppointmentConsumptionOptions,
): { item: InventoryItemV1; movements: InventoryMovementV1[] } {
  const usageHundredths = decimalQuantityToHundredths(options.usage.quantity);
  const inserted: InventoryMovementV1 = {
    id: options.movementId,
    inventoryItemId: options.item.id,
    type: "appointment-consumption",
    beforeQuantity: "0",
    deltaQuantity: hundredthsToDecimalQuantity(-usageHundredths),
    afterQuantity: "0",
    occurredAt: options.occurredAt,
    appointmentId: options.appointmentId,
    appointmentDeleted: false,
    createdAt: options.committedAt,
    updatedAt: options.committedAt,
    schemaVersion: 1,
  };
  const existingOrdered = [...options.movements].sort(
    (left, right) =>
      left.occurredAt.localeCompare(right.occurredAt) ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id),
  );
  const ordered = [...existingOrdered, inserted].sort(
    (left, right) =>
      left.occurredAt.localeCompare(right.occurredAt) ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id),
  );
  // 兼容早期没有首次入库记录的数据；无历史链时以当前库存作为可追溯起点。
  let currentHundredths = decimalQuantityToHundredths(
    existingOrdered[0]?.beforeQuantity ?? options.item.currentQuantity,
  );
  const replayed = ordered.map((movement) => {
    const beforeQuantity = hundredthsToDecimalQuantity(currentHundredths);
    let afterHundredths: number;
    if (movement.id === inserted.id) {
      afterHundredths = currentHundredths - usageHundredths;
    } else if (
      movement.type === "restock" ||
      movement.type === "appointment-consumption"
    ) {
      afterHundredths =
        currentHundredths +
        decimalQuantityToHundredths(movement.deltaQuantity);
    } else {
      afterHundredths = decimalQuantityToHundredths(movement.afterQuantity);
    }
    if (afterHundredths < 0) {
      throw new Error(
        `${options.usage.itemNameSnapshot}在实际完成时间的库存不足，无法完成预约`,
      );
    }
    const afterQuantity = hundredthsToDecimalQuantity(afterHundredths);
    const deltaQuantity = hundredthsToDecimalQuantity(
      afterHundredths - currentHundredths,
    );
    currentHundredths = afterHundredths;
    if (movement.id === inserted.id) {
      return {
        ...inserted,
        beforeQuantity,
        afterQuantity,
      };
    }
    if (
      movement.beforeQuantity === beforeQuantity &&
      movement.deltaQuantity === deltaQuantity &&
      movement.afterQuantity === afterQuantity
    ) {
      return movement;
    }
    return {
      ...movement,
      beforeQuantity,
      deltaQuantity,
      afterQuantity,
      updatedAt: advanceUpdatedAt(
        movement.updatedAt,
        options.committedAt,
        options.committedAt,
      ),
    };
  });
  return {
    item: {
      ...options.item,
      currentQuantity: hundredthsToDecimalQuantity(currentHundredths),
      updatedAt: advanceUpdatedAt(
        options.item.updatedAt,
        options.committedAt,
        options.committedAt,
      ),
    },
    movements: replayed,
  };
}

function replayInventoryMovementChain(
  item: InventoryItemV1,
  movements: readonly InventoryMovementV1[],
  baselineQuantity: string,
  committedAt: IsoDateTimeString,
): { item: InventoryItemV1; movements: InventoryMovementV1[] } {
  const ordered = [...movements].sort(
    (left, right) =>
      left.occurredAt.localeCompare(right.occurredAt) ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id),
  );
  let currentHundredths = decimalQuantityToHundredths(baselineQuantity);
  const replayed = ordered.map((movement) => {
    const beforeQuantity = hundredthsToDecimalQuantity(currentHundredths);
    const afterHundredths =
      movement.type === "restock" ||
      movement.type === "appointment-consumption"
        ? currentHundredths +
          decimalQuantityToHundredths(movement.deltaQuantity)
        : decimalQuantityToHundredths(movement.afterQuantity);
    if (afterHundredths < 0) {
      throw new Error(`${item.name}库存历史重放后低于零，无法撤销完成`);
    }
    const afterQuantity = hundredthsToDecimalQuantity(afterHundredths);
    const deltaQuantity = hundredthsToDecimalQuantity(
      afterHundredths - currentHundredths,
    );
    currentHundredths = afterHundredths;
    if (
      movement.beforeQuantity === beforeQuantity &&
      movement.deltaQuantity === deltaQuantity &&
      movement.afterQuantity === afterQuantity
    ) {
      return movement;
    }
    return {
      ...movement,
      beforeQuantity,
      deltaQuantity,
      afterQuantity,
      updatedAt: advanceUpdatedAt(
        movement.updatedAt,
        committedAt,
        committedAt,
      ),
    };
  });
  return {
    item: {
      ...item,
      currentQuantity: hundredthsToDecimalQuantity(currentHundredths),
      updatedAt: advanceUpdatedAt(item.updatedAt, committedAt, committedAt),
    },
    movements: replayed,
  };
}

function hasBusinessRecords(data: ApplicationData): boolean {
  return (
    data.inventoryItems.length > 0 ||
    data.inventoryMovements.length > 0 ||
    data.projects.length > 0 ||
    data.customers.length > 0 ||
    data.appointments.length > 0
  );
}

function earliestBusinessDataAt(
  data: ApplicationData,
  fallback: string,
): string {
  const timestamps = [
    ...data.inventoryItems,
    ...data.inventoryMovements,
    ...data.projects,
    ...data.customers,
    ...data.appointments,
  ].map((record) => record.createdAt);
  return timestamps.reduce(
    (earliest, timestamp) => (timestamp < earliest ? timestamp : earliest),
    fallback,
  );
}

/**
 * 把一条封闭命令应用到完整快照，并通过当前 migration 复核全部字段和引用。
 * 此函数不做 I/O；Storage adapter 只提交返回的已验证结果。
 */
export function applyBusinessDataMutation(
  current: ApplicationData,
  mutation: BusinessDataMutation,
  committedAt: string,
): ApplicationData {
  let candidate: ApplicationData;
  switch (mutation.kind) {
    case "upsert-inventory-item": {
        const persistedItem = current.inventoryItems.find(
          (item) => item.id === mutation.item.id,
        );
        if (
          persistedItem &&
          persistedItem.currentQuantity !== mutation.item.currentQuantity
        ) {
          throw new Error("库存资料保存不能修改当前库存，请刷新后重试");
        }
        if (
          persistedItem &&
          mutation.expectedUpdatedAt !== persistedItem.updatedAt
        ) {
          throw new Error("库存资料已被其他操作更新，请刷新后重试");
        }
        if (
          mutation.item.status === "active" &&
          current.inventoryItems.some(
            (item) =>
              item.id !== mutation.item.id &&
              item.status === "active" &&
              item.name.trim() === mutation.item.name.trim() &&
              item.unit.trim() === mutation.item.unit.trim(),
          )
        ) {
          throw new Error("已存在相同名称和单位的启用库存物品");
        }
        if (
          persistedItem &&
          (persistedItem.unit !== mutation.item.unit ||
            persistedItem.unitKind !== mutation.item.unitKind)
        ) {
          const referenced =
            current.projects.some((project) =>
              project.defaultUsages.some(
                (usage) => usage.inventoryItemId === mutation.item.id,
              ),
            ) ||
            current.appointments.some((appointment) =>
              appointment.actualUsages.some(
                (usage) => usage.inventoryItemId === mutation.item.id,
              ),
            ) ||
            current.inventoryMovements.some(
              (movement) =>
                movement.inventoryItemId === mutation.item.id &&
                movement.type === "appointment-consumption",
            );
          if (referenced) {
            throw new Error(
              "库存物品已有项目或预约引用，不能修改计量单位；请停用后新建",
            );
          }
        }
      candidate = {
        ...current,
        inventoryItems: upsertById(
          current.inventoryItems,
          persistedItem
            ? {
                ...mutation.item,
                updatedAt: advanceUpdatedAt(
                  persistedItem.updatedAt,
                  mutation.item.updatedAt,
                  committedAt,
                ),
              }
            : mutation.item,
        ),
      };
      break;
    }
    case "commit-inventory-adjustment":
      if (mutation.movement.inventoryItemId !== mutation.item.id) {
        throw new Error("库存变动与更新后的库存物品不匹配");
      }
      if (
        current.inventoryMovements.some(
          (movement) => movement.id === mutation.movement.id,
        )
      ) {
        throw new Error("库存变动标识已存在，不能重复提交");
      }
      {
        const existingItem = current.inventoryItems.find(
          (item) => item.id === mutation.item.id,
        );
        if (!existingItem && mutation.movement.type !== "initial") {
          throw new Error("新库存物品的首条变动必须为首次入库");
        }
        if (existingItem && mutation.movement.type === "initial") {
          throw new Error("已有库存物品不能重复提交首次入库");
        }
        const expectedBefore = existingItem?.currentQuantity ?? "0";
        if (
          mutation.movement.beforeQuantity !== expectedBefore ||
          mutation.movement.afterQuantity !== mutation.item.currentQuantity
        ) {
          throw new Error("库存变动前后数量与物品库存不一致");
        }
        if (
          decimalQuantityToHundredths(mutation.item.currentQuantity) <
          pendingOccupiedHundredths(current, mutation.item.id)
        ) {
          throw new Error("库存调整后将低于最新待执行预约占用，请刷新后重试");
        }
      }
      const committedItem = current.inventoryItems.find(
        (item) => item.id === mutation.item.id,
      );
      candidate = {
        ...current,
        inventoryItems: upsertById(
          current.inventoryItems,
          committedItem
            ? {
                ...committedItem,
                // 库存调整只拥有数量与本次更新时间，不得覆盖并发资料或状态修改。
                currentQuantity: mutation.item.currentQuantity,
                updatedAt: advanceUpdatedAt(
                  committedItem.updatedAt,
                  mutation.item.updatedAt,
                  committedAt,
                ),
              }
            : mutation.item,
        ),
        inventoryMovements: [
          ...current.inventoryMovements,
          mutation.movement,
        ],
      };
      break;
    case "upsert-beauty-project":
      {
        const persistedProject = current.projects.find(
          (project) => project.id === mutation.project.id,
        );
        if (
          persistedProject &&
          mutation.expectedUpdatedAt !== persistedProject.updatedAt
        ) {
          throw new Error("服务项目已被其他操作更新，请刷新后重试");
        }
      }
      if (
        mutation.project.status === "active" &&
        current.projects.some(
          (project) =>
            project.id !== mutation.project.id &&
            project.status === "active" &&
            project.name.trim() === mutation.project.name.trim(),
        )
      ) {
        throw new Error("已存在同名的启用服务项目");
      }
      for (const usage of mutation.project.status === "active"
        ? mutation.project.defaultUsages
        : []) {
        const referencedItem = current.inventoryItems.find(
          (item) =>
            item.id === usage.inventoryItemId && item.status === "active",
        );
        if (!referencedItem) {
          throw new Error("默认用量引用的库存物品不存在或已停用");
        }
        parseDecimalQuantity(usage.quantity, {
          unitKind: referencedItem.unitKind,
          positive: true,
        });
      }
      candidate = {
        ...current,
        projects: upsertById(
          current.projects,
          current.projects.some((project) => project.id === mutation.project.id)
            ? {
                ...mutation.project,
                updatedAt: advanceUpdatedAt(
                  current.projects.find(
                    (project) => project.id === mutation.project.id,
                  )!.updatedAt,
                  mutation.project.updatedAt,
                  committedAt,
                ),
              }
            : mutation.project,
        ),
      };
      break;
    case "upsert-customer":
      {
        const persistedCustomer = current.customers.find(
          (customer) => customer.id === mutation.customer.id,
        );
        if (
          persistedCustomer &&
          mutation.expectedUpdatedAt !== persistedCustomer.updatedAt
        ) {
          throw new Error("顾客资料已被其他操作更新，请刷新后重试");
        }
      }
      if (
        current.customers.some(
          (customer) =>
            customer.id !== mutation.customer.id &&
            (customer.nickname.trim() === mutation.customer.nickname.trim() ||
              customer.phone === mutation.customer.phone),
        )
      ) {
        throw new Error("顾客昵称或手机号已被其他顾客使用");
      }
      candidate = {
        ...current,
        customers: upsertById(
          current.customers,
          current.customers.some(
            (customer) => customer.id === mutation.customer.id,
          )
            ? {
                ...mutation.customer,
                updatedAt: advanceUpdatedAt(
                  current.customers.find(
                    (customer) => customer.id === mutation.customer.id,
                  )!.updatedAt,
                  mutation.customer.updatedAt,
                  committedAt,
                ),
              }
            : mutation.customer,
        ),
      };
      break;
    case "delete-unreferenced-inventory-item": {
      if (
        !current.inventoryItems.some(
          (item) => item.id === mutation.inventoryItemId,
        )
      ) {
        throw new Error("库存物品不存在");
      }
      const referencedByProject = current.projects.some((project) =>
        project.defaultUsages.some(
          (usage) => usage.inventoryItemId === mutation.inventoryItemId,
        ),
      );
      const referencedByAppointment = current.appointments.some((appointment) =>
        appointment.actualUsages.some(
          (usage) => usage.inventoryItemId === mutation.inventoryItemId,
        ),
      );
      const hasAppointmentConsumption = current.inventoryMovements.some(
        (movement) =>
          movement.inventoryItemId === mutation.inventoryItemId &&
          movement.type === "appointment-consumption",
      );
      if (
        referencedByProject ||
        referencedByAppointment ||
        hasAppointmentConsumption
      ) {
        throw new Error("库存物品已有项目或预约引用，只能停用");
      }
      candidate = {
        ...current,
        inventoryItems: current.inventoryItems.filter(
          (item) => item.id !== mutation.inventoryItemId,
        ),
        // 物品不存在后手工变动不能独立保留；预约消耗已在上方阻止删除。
        inventoryMovements: current.inventoryMovements.filter(
          (movement) => movement.inventoryItemId !== mutation.inventoryItemId,
        ),
      };
      break;
    }
    case "delete-unreferenced-beauty-project":
      if (!current.projects.some((project) => project.id === mutation.projectId)) {
        throw new Error("服务项目不存在");
      }
      if (
        current.appointments.some((appointment) =>
          appointment.projectSnapshots.some(
            (snapshot) => snapshot.projectId === mutation.projectId,
          ),
        )
      ) {
        throw new Error("服务项目已有预约引用，只能停用");
      }
      candidate = {
        ...current,
        projects: current.projects.filter(
          (project) => project.id !== mutation.projectId,
        ),
      };
      break;
    case "delete-unreferenced-customer":
      if (
        !current.customers.some(
          (customer) => customer.id === mutation.customerId,
        )
      ) {
        throw new Error("顾客不存在");
      }
      if (
        current.appointments.some(
          (appointment) => appointment.customerId === mutation.customerId,
        )
      ) {
        throw new Error("顾客已有预约记录，只能停用");
      }
      candidate = {
        ...current,
        customers: current.customers.filter(
          (customer) => customer.id !== mutation.customerId,
        ),
      };
      break;
    case "rewrite-manual-inventory-movements": {
      if (
        !current.inventoryItems.some((item) => item.id === mutation.item.id)
      ) {
        throw new Error("库存物品不存在");
      }
      if (
        mutation.movements.some(
          (movement) => movement.inventoryItemId !== mutation.item.id,
        ) ||
        new Set(mutation.movements.map((movement) => movement.id)).size !==
          mutation.movements.length
      ) {
        throw new Error("重放后的库存变动链标识无效");
      }
      const currentForItem = current.inventoryMovements.filter(
        (movement) => movement.inventoryItemId === mutation.item.id,
      );
      const currentVersions = currentForItem
        .map(({ id, updatedAt }) => ({ id, updatedAt }))
        .sort((left, right) => left.id.localeCompare(right.id));
      const expectedVersions = [...mutation.expectedMovements].sort(
        (left, right) => left.id.localeCompare(right.id),
      );
      if (JSON.stringify(currentVersions) !== JSON.stringify(expectedVersions)) {
        throw new Error("库存变动记录已被其他操作更新，请刷新后重试");
      }
      const currentIds = new Set(currentForItem.map((movement) => movement.id));
      if (mutation.movements.some((movement) => !currentIds.has(movement.id))) {
        throw new Error("手工变动重放不能新增库存记录");
      }
      const candidateById = new Map(
        mutation.movements.map((movement) => [movement.id, movement]),
      );
      for (const movement of currentForItem) {
        if (movement.type !== "appointment-consumption") {
          continue;
        }
        const candidateMovement = candidateById.get(movement.id);
        if (
          candidateMovement === undefined ||
          candidateMovement.inventoryItemId !== movement.inventoryItemId ||
          candidateMovement.type !== movement.type ||
          candidateMovement.deltaQuantity !== movement.deltaQuantity ||
          candidateMovement.note !== movement.note ||
          candidateMovement.occurredAt !== movement.occurredAt ||
          candidateMovement.appointmentId !== movement.appointmentId ||
          candidateMovement.appointmentDeleted !== movement.appointmentDeleted ||
          candidateMovement.createdAt !== movement.createdAt ||
          candidateMovement.schemaVersion !== movement.schemaVersion
        ) {
          throw new Error("预约消耗记录不能在库存记录中修改或删除");
        }
      }
      const ordered = [...mutation.movements].sort(
        (left, right) =>
          left.occurredAt.localeCompare(right.occurredAt) ||
          left.createdAt.localeCompare(right.createdAt) ||
          left.id.localeCompare(right.id),
      );
      // 兼容阶段 0 或外部恢复的旧链：首条记录可能没有配套首次入库记录。
      let expectedBefore = ordered[0]?.beforeQuantity ?? "0";
      for (const movement of ordered) {
        if (movement.beforeQuantity !== expectedBefore) {
          throw new Error("重放后的库存变动链不连续");
        }
        expectedBefore = movement.afterQuantity;
      }
      if (mutation.item.currentQuantity !== expectedBefore) {
        throw new Error("重放后的库存结余与物品当前库存不一致");
      }
      if (
        decimalQuantityToHundredths(mutation.item.currentQuantity) <
        pendingOccupiedHundredths(current, mutation.item.id)
      ) {
        throw new Error("库存重放后将低于最新待执行预约占用，请刷新后重试");
      }
      const latestItem = current.inventoryItems.find(
        (item) => item.id === mutation.item.id,
      )!;
      const versionedMovements = mutation.movements.map((movement) => {
        const persistedMovement = currentForItem.find(
          (candidateMovement) => candidateMovement.id === movement.id,
        );
        if (
          !persistedMovement ||
          JSON.stringify(persistedMovement) === JSON.stringify(movement)
        ) {
          return movement;
        }
        return {
          ...movement,
          updatedAt: advanceUpdatedAt(
            persistedMovement.updatedAt,
            movement.updatedAt,
            committedAt,
          ),
        };
      });
      candidate = {
        ...current,
        inventoryItems: upsertById(current.inventoryItems, {
          ...latestItem,
          // 重放只拥有库存结余与本次更新时间，不能覆盖并发物品资料。
          currentQuantity: mutation.item.currentQuantity,
          updatedAt: advanceUpdatedAt(
            latestItem.updatedAt,
            mutation.item.updatedAt,
            committedAt,
          ),
        }),
        inventoryMovements: [
          ...current.inventoryMovements.filter(
            (movement) => movement.inventoryItemId !== mutation.item.id,
          ),
          ...versionedMovements,
        ],
      };
      break;
    }
    case "upsert-pending-appointment": {
      const persistedAppointment = current.appointments.find(
        (appointment) => appointment.id === mutation.appointment.id,
      );
      if (persistedAppointment?.status !== "pending" && persistedAppointment) {
        throw new Error("只有待执行预约可以直接编辑");
      }
      if (
        persistedAppointment &&
        mutation.expectedUpdatedAt !== persistedAppointment.updatedAt
      ) {
        throw new Error("预约已被其他操作更新，请刷新后重试");
      }
      const customer = current.customers.find(
        (candidate) => candidate.id === mutation.appointment.customerId,
      );
      const retainsExistingCustomer =
        persistedAppointment?.customerId === mutation.appointment.customerId;
      if (
        !customer ||
        (customer.status !== "active" && !retainsExistingCustomer) ||
        customer.updatedAt !== mutation.expectedReferences.customerUpdatedAt
      ) {
        throw new Error("预约顾客资料已变化，请刷新后重试");
      }
      const projectVersions = [...mutation.expectedReferences.projects].sort(
        (left, right) => left.id.localeCompare(right.id),
      );
      const currentProjectVersions = mutation.appointment.projectSnapshots
        .map((snapshot) => {
          const project = current.projects.find(
            (candidate) => candidate.id === snapshot.projectId,
          );
          const retainsExistingSnapshot =
            persistedAppointment?.projectSnapshots.some(
              (existing) =>
                existing.projectId === snapshot.projectId &&
                existing.name === snapshot.name &&
                existing.standardPriceCents === snapshot.standardPriceCents &&
                existing.durationMinutes === snapshot.durationMinutes,
            ) ?? false;
          if (
            !project ||
            (!retainsExistingSnapshot &&
              (project.status !== "active" ||
                project.name !== snapshot.name ||
                project.standardPriceCents !== snapshot.standardPriceCents ||
                project.durationMinutes !== snapshot.durationMinutes))
          ) {
            throw new Error("预约服务项目资料已变化，请刷新后重试");
          }
          return { id: project.id, updatedAt: project.updatedAt };
        })
        .sort((left, right) => left.id.localeCompare(right.id));
      if (JSON.stringify(projectVersions) !== JSON.stringify(currentProjectVersions)) {
        throw new Error("预约服务项目资料已变化，请刷新后重试");
      }
      const itemVersions = [...mutation.expectedReferences.inventoryItems].sort(
        (left, right) => left.id.localeCompare(right.id),
      );
      const currentItemVersions = mutation.appointment.actualUsages
        .map((usage) => {
          const item = current.inventoryItems.find(
            (candidate) => candidate.id === usage.inventoryItemId,
          );
          const retainsExistingSnapshot =
            persistedAppointment?.actualUsages.some(
              (existing) =>
                existing.inventoryItemId === usage.inventoryItemId &&
                existing.itemNameSnapshot === usage.itemNameSnapshot &&
                existing.unitSnapshot === usage.unitSnapshot,
            ) ?? false;
          if (
            !item ||
            (!retainsExistingSnapshot &&
              (item.status !== "active" ||
                item.name !== usage.itemNameSnapshot ||
                item.unit !== usage.unitSnapshot))
          ) {
            throw new Error("预约库存资料已变化，请刷新后重试");
          }
          parseDecimalQuantity(usage.quantity, {
            unitKind: item.unitKind,
            positive: true,
          });
          let occupiedHundredths = 0;
          for (const appointment of current.appointments) {
            if (
              appointment.status !== "pending" ||
              appointment.id === mutation.appointment.id
            ) {
              continue;
            }
            for (const occupiedUsage of appointment.actualUsages) {
              if (occupiedUsage.inventoryItemId === item.id) {
                occupiedHundredths += decimalQuantityToHundredths(
                  occupiedUsage.quantity,
                );
                if (!Number.isSafeInteger(occupiedHundredths)) {
                  throw new Error("预约占用数量超出可安全计算范围");
                }
              }
            }
          }
          const availableHundredths =
            decimalQuantityToHundredths(item.currentQuantity) -
            occupiedHundredths;
          if (
            decimalQuantityToHundredths(usage.quantity) > availableHundredths
          ) {
            throw new Error(`${item.name}可用库存不足，请刷新后调整用量`);
          }
          return { id: item.id, updatedAt: item.updatedAt };
        })
        .sort((left, right) => left.id.localeCompare(right.id));
      if (JSON.stringify(itemVersions) !== JSON.stringify(currentItemVersions)) {
        throw new Error("预约库存资料已变化，请刷新后重试");
      }
      candidate = {
        ...current,
        appointments: upsertById(
          current.appointments,
          persistedAppointment
            ? {
                ...mutation.appointment,
                updatedAt: advanceUpdatedAt(
                  persistedAppointment.updatedAt,
                  mutation.appointment.updatedAt,
                  committedAt,
                ),
              }
            : mutation.appointment,
        ),
      };
      break;
    }
    case "cancel-pending-appointment": {
      const persistedAppointment = current.appointments.find(
        (appointment) => appointment.id === mutation.appointmentId,
      );
      if (!persistedAppointment) {
        throw new Error("预约不存在");
      }
      if (persistedAppointment.status !== "pending") {
        throw new Error("只有待执行预约可以取消");
      }
      if (persistedAppointment.updatedAt !== mutation.expectedUpdatedAt) {
        throw new Error("预约已被其他操作更新，请刷新后重试");
      }
      const cancelReason = mutation.cancelReason?.trim();
      candidate = {
        ...current,
        appointments: upsertById(current.appointments, {
          ...persistedAppointment,
          status: "cancelled",
          cancelledAt: mutation.cancelledAt,
          ...(cancelReason ? { cancelReason } : {}),
          updatedAt: advanceUpdatedAt(
            persistedAppointment.updatedAt,
            mutation.updatedAt,
            committedAt,
          ),
        }),
      };
      break;
    }
    case "restore-cancelled-appointment": {
      const persistedAppointment = current.appointments.find(
        (appointment) => appointment.id === mutation.appointmentId,
      );
      if (!persistedAppointment) {
        throw new Error("预约不存在");
      }
      if (persistedAppointment.status !== "cancelled") {
        throw new Error("只有已取消预约可以恢复取消");
      }
      if (persistedAppointment.updatedAt !== mutation.expectedUpdatedAt) {
        throw new Error("预约已被其他操作更新，请刷新后重试");
      }
      for (const usage of persistedAppointment.actualUsages) {
        const item = current.inventoryItems.find(
          (candidateItem) => candidateItem.id === usage.inventoryItemId,
        );
        if (!item) {
          throw new Error(`${usage.itemNameSnapshot}库存物品不存在，无法恢复取消`);
        }
        parseDecimalQuantity(usage.quantity, {
          unitKind: item.unitKind,
          positive: true,
        });
        const availableHundredths =
          decimalQuantityToHundredths(item.currentQuantity) -
          pendingOccupiedHundredths(current, item.id);
        const shortageHundredths =
          decimalQuantityToHundredths(usage.quantity) - availableHundredths;
        if (shortageHundredths > 0) {
          throw new Error(
            `${usage.itemNameSnapshot}库存不足，缺少 ${hundredthsToDecimalQuantity(shortageHundredths)}${usage.unitSnapshot}`,
          );
        }
      }
      candidate = {
        ...current,
        appointments: upsertById(current.appointments, {
          ...persistedAppointment,
          status: "pending",
          updatedAt: advanceUpdatedAt(
            persistedAppointment.updatedAt,
            mutation.updatedAt,
            committedAt,
          ),
          cancelReason: undefined,
          cancelledAt: undefined,
        }),
      };
      break;
    }
    case "complete-pending-appointment": {
      const persistedAppointment = current.appointments.find(
        (appointment) => appointment.id === mutation.appointmentId,
      );
      if (!persistedAppointment) {
        throw new Error("预约不存在");
      }
      if (persistedAppointment.status !== "pending") {
        throw new Error("只有待执行预约可以完成");
      }
      if (persistedAppointment.updatedAt !== mutation.expectedUpdatedAt) {
        throw new Error("预约已被其他操作更新，请刷新后重试");
      }
      if (
        !Number.isSafeInteger(mutation.transactionAmountCents) ||
        mutation.transactionAmountCents < 0
      ) {
        throw new Error("成交金额必须是大于等于零的整数分");
      }
      if (
        new Set(mutation.actualUsages.map((usage) => usage.inventoryItemId))
          .size !== mutation.actualUsages.length
      ) {
        throw new Error("同一库存物品不能在预约实际用量中重复");
      }
      const movementIdByItemId = new Map(
        mutation.movementIds.map(({ inventoryItemId, movementId }) => [
          inventoryItemId,
          movementId,
        ]),
      );
      if (
        movementIdByItemId.size !== mutation.actualUsages.length ||
        mutation.movementIds.length !== mutation.actualUsages.length ||
        new Set(mutation.movementIds.map(({ movementId }) => movementId)).size !==
          mutation.movementIds.length ||
        mutation.movementIds.some(({ movementId }) =>
          current.inventoryMovements.some((movement) => movement.id === movementId),
        )
      ) {
        throw new Error("预约消耗记录标识无效或已存在");
      }
      const nextItems = [...current.inventoryItems];
      let nextMovements = [...current.inventoryMovements];
      const committedActualUsages: AppointmentUsageV1[] = [];
      for (const usage of mutation.actualUsages) {
        const itemIndex = nextItems.findIndex(
          (candidateItem) => candidateItem.id === usage.inventoryItemId,
        );
        const latestItem = nextItems[itemIndex];
        const movementId = movementIdByItemId.get(usage.inventoryItemId);
        if (!latestItem || !movementId) {
          throw new Error(`${usage.itemNameSnapshot}库存物品不存在，无法完成预约`);
        }
        const persistedUsage = persistedAppointment.actualUsages.find(
          (candidateUsage) =>
            candidateUsage.inventoryItemId === usage.inventoryItemId,
        );
        if (
          persistedUsage
            ? persistedUsage.itemNameSnapshot !== usage.itemNameSnapshot ||
              persistedUsage.unitSnapshot !== usage.unitSnapshot
            : latestItem.status !== "active" ||
              latestItem.name !== usage.itemNameSnapshot ||
              latestItem.unit !== usage.unitSnapshot
        ) {
          throw new Error("完成用量的库存快照无效，请刷新后重试");
        }
        const quantity = parseDecimalQuantity(usage.quantity, {
          unitKind: latestItem.unitKind,
          positive: true,
        });
        const committedUsage = { ...usage, quantity };
        const replayed = insertAppointmentConsumption({
          item: latestItem,
          movements: nextMovements.filter(
            (movement) => movement.inventoryItemId === latestItem.id,
          ),
          movementId,
          appointmentId: persistedAppointment.id,
          usage: committedUsage,
          occurredAt: mutation.completedAt,
          committedAt,
        });
        const otherOccupiedHundredths = pendingOccupiedHundredths(
          current,
          latestItem.id,
          persistedAppointment.id,
        );
        const replayedCurrentHundredths = decimalQuantityToHundredths(
          replayed.item.currentQuantity,
        );
        if (replayedCurrentHundredths < otherOccupiedHundredths) {
          const shortageHundredths =
            otherOccupiedHundredths - replayedCurrentHundredths;
          throw new Error(
            `${usage.itemNameSnapshot}库存不足，完成后还缺少 ${hundredthsToDecimalQuantity(shortageHundredths)}${usage.unitSnapshot}`,
          );
        }
        nextItems[itemIndex] = replayed.item;
        nextMovements = [
          ...nextMovements.filter(
            (movement) => movement.inventoryItemId !== latestItem.id,
          ),
          ...replayed.movements,
        ];
        committedActualUsages.push(committedUsage);
      }
      const note = mutation.note?.trim();
      candidate = {
        ...current,
        inventoryItems: nextItems,
        inventoryMovements: nextMovements,
        appointments: upsertById(current.appointments, {
          ...persistedAppointment,
          status: "completed",
          actualUsages: committedActualUsages,
          transactionAmountCents: mutation.transactionAmountCents,
          completedAt: mutation.completedAt,
          ...(note ? { note } : { note: undefined }),
          updatedAt: advanceUpdatedAt(
            persistedAppointment.updatedAt,
            mutation.updatedAt,
            committedAt,
          ),
        }),
      };
      break;
    }
    case "correct-completed-appointment": {
      const persistedAppointment = current.appointments.find(
        (appointment) => appointment.id === mutation.appointmentId,
      );
      if (!persistedAppointment) {
        throw new Error("预约不存在");
      }
      if (persistedAppointment.status !== "completed") {
        throw new Error("只有已完成预约可以更正完成信息");
      }
      if (persistedAppointment.updatedAt !== mutation.expectedUpdatedAt) {
        throw new Error("预约已被其他操作更新，请刷新后重试");
      }
      if (
        !Number.isSafeInteger(mutation.transactionAmountCents) ||
        mutation.transactionAmountCents < 0
      ) {
        throw new Error("成交金额必须是大于等于零的整数分");
      }
      if (
        new Set(mutation.actualUsages.map((usage) => usage.inventoryItemId))
          .size !== mutation.actualUsages.length
      ) {
        throw new Error("同一库存物品不能在预约实际用量中重复");
      }
      const previousAppointmentMovements = current.inventoryMovements.filter(
        (movement) =>
          movement.type === "appointment-consumption" &&
          !movement.appointmentDeleted &&
          movement.appointmentId === persistedAppointment.id,
      );
      if (
        previousAppointmentMovements.length !==
        persistedAppointment.actualUsages.length
      ) {
        throw new Error("预约消耗记录缺失或重复，无法更正完成信息");
      }
      const previousMovementIds = new Set(
        previousAppointmentMovements.map((movement) => movement.id),
      );
      const movementIdByItemId = new Map(
        mutation.movementIds.map(({ inventoryItemId, movementId }) => [
          inventoryItemId,
          movementId,
        ]),
      );
      if (
        movementIdByItemId.size !== mutation.actualUsages.length ||
        mutation.movementIds.length !== mutation.actualUsages.length ||
        new Set(mutation.movementIds.map(({ movementId }) => movementId)).size !==
          mutation.movementIds.length ||
        mutation.movementIds.some(({ inventoryItemId, movementId }) => {
          const existingMovement = current.inventoryMovements.find(
            (movement) => movement.id === movementId,
          );
          return (
            existingMovement !== undefined &&
            (!previousMovementIds.has(movementId) ||
              existingMovement.inventoryItemId !== inventoryItemId)
          );
        })
      ) {
        throw new Error("预约消耗记录标识无效或已被其他记录使用");
      }
      const nextItems = [...current.inventoryItems];
      let nextMovements = [...current.inventoryMovements];
      for (const previousUsage of persistedAppointment.actualUsages) {
        const itemIndex = nextItems.findIndex(
          (item) => item.id === previousUsage.inventoryItemId,
        );
        const latestItem = nextItems[itemIndex];
        if (!latestItem) {
          throw new Error(`${previousUsage.itemNameSnapshot}库存物品不存在，无法更正完成信息`);
        }
        const currentForItem = nextMovements
          .filter((movement) => movement.inventoryItemId === latestItem.id)
          .sort(
            (left, right) =>
              left.occurredAt.localeCompare(right.occurredAt) ||
              left.createdAt.localeCompare(right.createdAt) ||
              left.id.localeCompare(right.id),
          );
        const removed = currentForItem.filter(
          (movement) =>
            movement.type === "appointment-consumption" &&
            !movement.appointmentDeleted &&
            movement.appointmentId === persistedAppointment.id,
        );
        if (removed.length !== 1) {
          throw new Error("预约消耗记录缺失或重复，无法更正完成信息");
        }
        const replayed = replayInventoryMovementChain(
          latestItem,
          currentForItem.filter((movement) => movement.id !== removed[0]!.id),
          currentForItem[0]?.beforeQuantity ?? latestItem.currentQuantity,
          committedAt,
        );
        nextItems[itemIndex] = replayed.item;
        nextMovements = [
          ...nextMovements.filter(
            (movement) => movement.inventoryItemId !== latestItem.id,
          ),
          ...replayed.movements,
        ];
      }
      const committedActualUsages: AppointmentUsageV1[] = [];
      for (const usage of mutation.actualUsages) {
        const itemIndex = nextItems.findIndex(
          (item) => item.id === usage.inventoryItemId,
        );
        const latestItem = nextItems[itemIndex];
        const movementId = movementIdByItemId.get(usage.inventoryItemId);
        if (!latestItem || !movementId) {
          throw new Error(`${usage.itemNameSnapshot}库存物品不存在，无法更正完成信息`);
        }
        const previousUsage = persistedAppointment.actualUsages.find(
          (candidateUsage) =>
            candidateUsage.inventoryItemId === usage.inventoryItemId,
        );
        if (
          previousUsage
            ? previousUsage.itemNameSnapshot !== usage.itemNameSnapshot ||
              previousUsage.unitSnapshot !== usage.unitSnapshot
            : latestItem.status !== "active" ||
              latestItem.name !== usage.itemNameSnapshot ||
              latestItem.unit !== usage.unitSnapshot
        ) {
          throw new Error("更正用量的库存快照无效，请刷新后重试");
        }
        const committedUsage: AppointmentUsageV1 = {
          ...usage,
          quantity: parseDecimalQuantity(usage.quantity, {
            unitKind: latestItem.unitKind,
            positive: true,
          }),
        };
        const replayed = insertAppointmentConsumption({
          item: latestItem,
          movements: nextMovements.filter(
            (movement) => movement.inventoryItemId === latestItem.id,
          ),
          movementId,
          appointmentId: persistedAppointment.id,
          usage: committedUsage,
          occurredAt: mutation.completedAt,
          committedAt,
        });
        const occupiedHundredths = pendingOccupiedHundredths(
          current,
          latestItem.id,
        );
        const correctedCurrentHundredths = decimalQuantityToHundredths(
          replayed.item.currentQuantity,
        );
        if (correctedCurrentHundredths < occupiedHundredths) {
          throw new Error(
            `${usage.itemNameSnapshot}库存不足，更正后还缺少 ${hundredthsToDecimalQuantity(occupiedHundredths - correctedCurrentHundredths)}${usage.unitSnapshot}`,
          );
        }
        nextItems[itemIndex] = replayed.item;
        nextMovements = [
          ...nextMovements.filter(
            (movement) => movement.inventoryItemId !== latestItem.id,
          ),
          ...replayed.movements,
        ];
        committedActualUsages.push(committedUsage);
      }
      const note = mutation.note?.trim();
      candidate = {
        ...current,
        inventoryItems: nextItems,
        inventoryMovements: nextMovements,
        appointments: upsertById(current.appointments, {
          ...persistedAppointment,
          actualUsages: committedActualUsages,
          transactionAmountCents: mutation.transactionAmountCents,
          completedAt: mutation.completedAt,
          ...(note ? { note } : { note: undefined }),
          updatedAt: advanceUpdatedAt(
            persistedAppointment.updatedAt,
            mutation.updatedAt,
            committedAt,
          ),
        }),
      };
      break;
    }
    case "revert-completed-appointment": {
      const persistedAppointment = current.appointments.find(
        (appointment) => appointment.id === mutation.appointmentId,
      );
      if (!persistedAppointment) {
        throw new Error("预约不存在");
      }
      if (persistedAppointment.status !== "completed") {
        throw new Error("只有已完成预约可以撤销完成");
      }
      if (persistedAppointment.updatedAt !== mutation.expectedUpdatedAt) {
        throw new Error("预约已被其他操作更新，请刷新后重试");
      }
      const nextItems = [...current.inventoryItems];
      let nextMovements = [...current.inventoryMovements];
      for (const usage of persistedAppointment.actualUsages) {
        const itemIndex = nextItems.findIndex(
          (item) => item.id === usage.inventoryItemId,
        );
        const latestItem = nextItems[itemIndex];
        if (!latestItem) {
          throw new Error(`${usage.itemNameSnapshot}库存物品不存在，无法撤销完成`);
        }
        const currentForItem = nextMovements
          .filter((movement) => movement.inventoryItemId === latestItem.id)
          .sort(
            (left, right) =>
              left.occurredAt.localeCompare(right.occurredAt) ||
              left.createdAt.localeCompare(right.createdAt) ||
              left.id.localeCompare(right.id),
          );
        const appointmentMovements = currentForItem.filter(
          (movement) =>
            movement.type === "appointment-consumption" &&
            !movement.appointmentDeleted &&
            movement.appointmentId === persistedAppointment.id,
        );
        if (appointmentMovements.length !== 1) {
          throw new Error("预约消耗记录缺失或重复，无法撤销完成");
        }
        const removedIds = new Set(
          appointmentMovements.map((movement) => movement.id),
        );
        const replayed = replayInventoryMovementChain(
          latestItem,
          currentForItem.filter((movement) => !removedIds.has(movement.id)),
          currentForItem[0]?.beforeQuantity ?? latestItem.currentQuantity,
          committedAt,
        );
        const requiredHundredths =
          pendingOccupiedHundredths(current, latestItem.id) +
          decimalQuantityToHundredths(usage.quantity);
        const restoredCurrentHundredths = decimalQuantityToHundredths(
          replayed.item.currentQuantity,
        );
        if (restoredCurrentHundredths < requiredHundredths) {
          throw new Error(
            `${usage.itemNameSnapshot}库存不足，撤销完成后缺少 ${hundredthsToDecimalQuantity(requiredHundredths - restoredCurrentHundredths)}${usage.unitSnapshot}`,
          );
        }
        nextItems[itemIndex] = replayed.item;
        nextMovements = [
          ...nextMovements.filter(
            (movement) => movement.inventoryItemId !== latestItem.id,
          ),
          ...replayed.movements,
        ];
      }
      candidate = {
        ...current,
        inventoryItems: nextItems,
        inventoryMovements: nextMovements,
        appointments: upsertById(current.appointments, {
          ...persistedAppointment,
          status: "pending",
          transactionAmountCents: undefined,
          completedAt: undefined,
          updatedAt: advanceUpdatedAt(
            persistedAppointment.updatedAt,
            mutation.updatedAt,
            committedAt,
          ),
        }),
      };
      break;
    }
    case "delete-appointment": {
      const persistedAppointment = current.appointments.find(
        (appointment) => appointment.id === mutation.appointmentId,
      );
      if (!persistedAppointment) {
        throw new Error("预约不存在");
      }
      if (persistedAppointment.status !== mutation.expectedStatus) {
        throw new Error("预约状态已变化，请刷新后重试");
      }
      if (persistedAppointment.updatedAt !== mutation.expectedUpdatedAt) {
        throw new Error("预约已被其他操作更新，请刷新后重试");
      }
      let inventoryMovements = current.inventoryMovements;
      if (persistedAppointment.status === "completed") {
        const appointmentMovements = current.inventoryMovements.filter(
          (movement) =>
            movement.type === "appointment-consumption" &&
            !movement.appointmentDeleted &&
            movement.appointmentId === persistedAppointment.id,
        );
        if (
          appointmentMovements.length !==
            persistedAppointment.actualUsages.length ||
          persistedAppointment.actualUsages.some(
            (usage) =>
              appointmentMovements.filter(
                (movement) =>
                  movement.inventoryItemId === usage.inventoryItemId,
              ).length !== 1,
          )
        ) {
          throw new Error("预约消耗记录缺失或重复，不能删除已完成预约");
        }
        inventoryMovements = current.inventoryMovements.map((movement) =>
          appointmentMovements.some(
            (appointmentMovement) => appointmentMovement.id === movement.id,
          )
            ? {
                ...movement,
                appointmentDeleted: true,
                updatedAt: advanceUpdatedAt(
                  movement.updatedAt,
                  mutation.updatedAt,
                  committedAt,
                ),
              }
            : movement,
        );
      }
      candidate = {
        ...current,
        appointments: current.appointments.filter(
          (appointment) => appointment.id !== persistedAppointment.id,
        ),
        inventoryMovements,
      };
      break;
    }
  }

  if (
    !current.backupMetadata.firstBusinessDataAt &&
    hasBusinessRecords(candidate)
  ) {
    candidate = {
      ...candidate,
      backupMetadata: {
        ...candidate.backupMetadata,
        // 兼容已有业务记录但旧元数据缺失的情况，提醒基准不得被重置到今天。
        firstBusinessDataAt: earliestBusinessDataAt(candidate, committedAt),
      },
    };
  }
  return migrateApplicationData(candidate);
}
