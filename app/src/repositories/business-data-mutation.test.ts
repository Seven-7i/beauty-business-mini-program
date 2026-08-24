import { describe, expect, it } from "vitest";
import type {
  ApplicationData,
  BeautyProjectV1,
  CustomerV1,
  InventoryItemV1,
  InventoryMovementV1,
  PendingAppointmentV1,
} from "@/domain/data-schema";
import { applyBusinessDataMutation } from "./business-data-mutation";

const NOW = "2026-08-08T08:30:00.000Z";

function emptyData(): ApplicationData {
  return {
    schemaVersion: 1,
    settings: { schemaVersion: 1 },
    unlockedModules: ["beauty"],
    backupMetadata: { schemaVersion: 1 },
    inventoryItems: [],
    inventoryMovements: [],
    projects: [],
    customers: [],
    appointments: [],
  };
}

const item: InventoryItemV1 = {
  id: "item-1",
  name: "精华液",
  unit: "毫升",
  unitKind: "continuous",
  currentQuantity: "12",
  status: "active",
  createdAt: NOW,
  updatedAt: NOW,
  schemaVersion: 1,
};

const movement: InventoryMovementV1 = {
  id: "movement-1",
  inventoryItemId: "item-1",
  type: "restock",
  beforeQuantity: "10",
  deltaQuantity: "2",
  afterQuantity: "12",
  occurredAt: NOW,
  appointmentDeleted: false,
  createdAt: NOW,
  updatedAt: NOW,
  schemaVersion: 1,
};

const project: BeautyProjectV1 = {
  id: "project-1",
  name: "补水护理",
  standardPriceCents: 8800,
  durationMinutes: 60,
  defaultUsages: [{ inventoryItemId: "item-1", quantity: "1.5" }],
  status: "active",
  createdAt: NOW,
  updatedAt: NOW,
  schemaVersion: 1,
};

const customer: CustomerV1 = {
  id: "customer-1",
  nickname: "小雨",
  phone: "13800138000",
  addresses: [{ id: "address-1", addressText: "朝阳路 1 号" }],
  status: "active",
  createdAt: NOW,
  updatedAt: NOW,
  schemaVersion: 1,
};

function createPendingAppointment(
  overrides: Partial<PendingAppointmentV1> = {},
): PendingAppointmentV1 {
  return {
    id: "appointment-1",
    customerId: customer.id,
    projectSnapshots: [
      {
        projectId: project.id,
        name: project.name,
        standardPriceCents: project.standardPriceCents,
        durationMinutes: project.durationMinutes,
      },
    ],
    standardAmountCents: project.standardPriceCents,
    estimatedDurationMinutes: project.durationMinutes,
    actualUsages: [
      {
        inventoryItemId: item.id,
        itemNameSnapshot: item.name,
        unitSnapshot: item.unit,
        quantity: "2",
      },
    ],
    scheduledAt: "2026-08-09T08:30:00.000Z",
    serviceAddressSnapshot: { addressText: "建设路 8 号" },
    status: "pending",
    createdAt: NOW,
    updatedAt: NOW,
    schemaVersion: 1,
    ...overrides,
  };
}

describe("业务数据变更命令", () => {
  it("新增顾客并设置首次业务数据时间", () => {
    const next = applyBusinessDataMutation(
      emptyData(),
      { kind: "upsert-customer", customer },
      NOW,
    );

    expect(next.customers).toEqual([customer]);
    expect(next.backupMetadata.firstBusinessDataAt).toBe(NOW);
  });

  it("只允许删除从未关联预约的顾客", () => {
    const current = { ...emptyData(), customers: [customer] };
    const removed = applyBusinessDataMutation(
      current,
      { kind: "delete-unreferenced-customer", customerId: customer.id },
      NOW,
    );
    expect(removed.customers).toEqual([]);

    const referenced = {
      ...current,
      appointments: [
        {
          id: "appointment-1",
          customerId: customer.id,
          projectSnapshots: [
            {
              projectId: "project-1",
              name: "补水护理",
              standardPriceCents: 8800,
              durationMinutes: 60,
            },
          ],
          standardAmountCents: 8800,
          estimatedDurationMinutes: 60,
          actualUsages: [],
          scheduledAt: NOW,
          serviceAddressSnapshot: { addressText: "测试地址" },
          status: "cancelled" as const,
          cancelledAt: NOW,
          createdAt: NOW,
          updatedAt: NOW,
          schemaVersion: 1 as const,
        },
      ],
    };
    expect(() =>
      applyBusinessDataMutation(
        referenced,
        { kind: "delete-unreferenced-customer", customerId: customer.id },
        NOW,
      ),
    ).toThrow("只能停用");
  });

  it("首次保存业务数据时同时记录七天提醒基准", () => {
    const next = applyBusinessDataMutation(
      emptyData(),
      { kind: "upsert-inventory-item", item },
      NOW,
    );
    expect(next.inventoryItems).toEqual([item]);
    expect(next.backupMetadata.firstBusinessDataAt).toBe(NOW);
  });

  it("库存资料命令拒绝用旧快照覆盖并发完成的库存调整", () => {
    const current = { ...emptyData(), inventoryItems: [item] };
    const staleProfile = {
      ...item,
      name: "精华液（新名称）",
      currentQuantity: "10",
    };

    expect(() =>
      applyBusinessDataMutation(
        current,
        { kind: "upsert-inventory-item", item: staleProfile },
        NOW,
      ),
    ).toThrow("不能修改当前库存");
    expect(current.inventoryItems[0]?.currentQuantity).toBe("12");
  });

  it("同一毫秒内连续资料命令也会推进版本并拒绝旧命令覆盖", () => {
    const current = { ...emptyData(), inventoryItems: [item] };
    const first = applyBusinessDataMutation(
      current,
      {
        kind: "upsert-inventory-item",
        item: { ...item, note: "第一次修改" },
        expectedUpdatedAt: item.updatedAt,
      },
      NOW,
    );
    expect(first.inventoryItems[0]!.updatedAt > item.updatedAt).toBe(true);

    expect(() =>
      applyBusinessDataMutation(
        first,
        {
          kind: "upsert-inventory-item",
          item: { ...item, note: "旧快照第二次修改" },
          expectedUpdatedAt: item.updatedAt,
        },
        NOW,
      ),
    ).toThrow("已被其他操作更新");
  });

  it("盘点和手工链重放都按最新待执行预约占用复核库存下限", () => {
    const occupiedAppointment = {
      id: "appointment-occupied",
      customerId: customer.id,
      projectSnapshots: [
        {
          projectId: project.id,
          name: project.name,
          standardPriceCents: project.standardPriceCents,
          durationMinutes: project.durationMinutes,
        },
      ],
      standardAmountCents: project.standardPriceCents,
      estimatedDurationMinutes: project.durationMinutes,
      actualUsages: [
        {
          inventoryItemId: item.id,
          itemNameSnapshot: item.name,
          unitSnapshot: item.unit,
          quantity: "8",
        },
      ],
      scheduledAt: NOW,
      serviceAddressSnapshot: { addressText: "测试地址" },
      status: "pending" as const,
      createdAt: NOW,
      updatedAt: NOW,
      schemaVersion: 1 as const,
    };
    const initialMovement: InventoryMovementV1 = {
      ...movement,
      id: "initial-occupied",
      type: "initial",
      beforeQuantity: "0",
      deltaQuantity: "12",
      afterQuantity: "12",
    };
    const current = {
      ...emptyData(),
      inventoryItems: [item],
      inventoryMovements: [initialMovement],
      projects: [project],
      customers: [customer],
      appointments: [occupiedAppointment],
    };
    const reducedItem = { ...item, currentQuantity: "5" };
    const stocktake: InventoryMovementV1 = {
      ...movement,
      id: "stocktake-occupied",
      type: "stocktake",
      beforeQuantity: "12",
      deltaQuantity: "-7",
      afterQuantity: "5",
    };

    expect(() =>
      applyBusinessDataMutation(
        current,
        { kind: "commit-inventory-adjustment", item: reducedItem, movement: stocktake },
        NOW,
      ),
    ).toThrow("低于最新待执行预约占用");
    expect(() =>
      applyBusinessDataMutation(
        current,
        {
          kind: "rewrite-manual-inventory-movements",
          item: reducedItem,
          movements: [{ ...initialMovement, deltaQuantity: "5", afterQuantity: "5" }],
          expectedMovements: [
            { id: initialMovement.id, updatedAt: initialMovement.updatedAt },
          ],
        },
        NOW,
      ),
    ).toThrow("低于最新待执行预约占用");
  });

  it("旧业务数据缺少提醒元数据时保留最早业务时间，不重置为今天", () => {
    const olderItem = {
      ...item,
      createdAt: "2026-07-01T08:00:00.000Z",
      updatedAt: "2026-07-01T08:00:00.000Z",
    };
    const current = { ...emptyData(), inventoryItems: [olderItem] };

    const next = applyBusinessDataMutation(
      current,
      {
        kind: "upsert-inventory-item",
        item: { ...olderItem, note: "补充说明" },
        expectedUpdatedAt: olderItem.updatedAt,
      },
      NOW,
    );

    expect(next.backupMetadata.firstBusinessDataAt).toBe(
      "2026-07-01T08:00:00.000Z",
    );
  });

  it("库存调整原子结果同时包含物品和唯一变动记录", () => {
    const current = applyBusinessDataMutation(
      emptyData(),
      {
        kind: "upsert-inventory-item",
        item: { ...item, currentQuantity: "10" },
      },
      NOW,
    );
    const next = applyBusinessDataMutation(
      current,
      { kind: "commit-inventory-adjustment", item, movement },
      NOW,
    );
    expect(next.inventoryItems[0]).toMatchObject({
      ...item,
      updatedAt: expect.any(String),
    });
    expect(next.inventoryItems[0]!.updatedAt > item.updatedAt).toBe(true);
    expect(next.inventoryMovements).toEqual([movement]);
    expect(() =>
      applyBusinessDataMutation(
        next,
        { kind: "commit-inventory-adjustment", item, movement },
        NOW,
      ),
    ).toThrow("不能重复提交");
  });

  it("拒绝库存物品与变动引用不一致的组合", () => {
    expect(() =>
      applyBusinessDataMutation(
        emptyData(),
        {
          kind: "commit-inventory-adjustment",
          item,
          movement: { ...movement, inventoryItemId: "other-item" },
        },
        NOW,
      ),
    ).toThrow("不匹配");
  });

  it("拒绝绕过用例层提交与当前库存不连续的变动", () => {
    expect(() =>
      applyBusinessDataMutation(
        emptyData(),
        { kind: "commit-inventory-adjustment", item, movement },
        NOW,
      ),
    ).toThrow("首条变动必须为首次入库");

    const current = applyBusinessDataMutation(
      emptyData(),
      {
        kind: "upsert-inventory-item",
        item: { ...item, currentQuantity: "9" },
      },
      NOW,
    );
    expect(() =>
      applyBusinessDataMutation(
        current,
        { kind: "commit-inventory-adjustment", item, movement },
        NOW,
      ),
    ).toThrow("前后数量与物品库存不一致");
  });

  it("保存项目时复核库存引用且不修改输入快照", () => {
    const current = applyBusinessDataMutation(
      emptyData(),
      { kind: "upsert-inventory-item", item },
      NOW,
    );
    const before = JSON.stringify(current);

    const next = applyBusinessDataMutation(
      current,
      { kind: "upsert-beauty-project", project },
      NOW,
    );

    expect(next.projects).toEqual([project]);
    expect(JSON.stringify(current)).toBe(before);
    expect(() =>
      applyBusinessDataMutation(
        emptyData(),
        { kind: "upsert-beauty-project", project },
        NOW,
      ),
    ).toThrow("不存在或已停用");
  });

  it("项目提交时基于最新快照拒绝已停用的默认用量物品", () => {
    const current = {
      ...emptyData(),
      inventoryItems: [{ ...item, status: "inactive" as const }],
    };

    expect(() =>
      applyBusinessDataMutation(
        current,
        { kind: "upsert-beauty-project", project },
        NOW,
      ),
    ).toThrow("不存在或已停用");
  });

  it("库存资料提交时基于最新快照保护历史预约消耗的计量单位", () => {
    const consumption: InventoryMovementV1 = {
      ...movement,
      id: "consumption-1",
      type: "appointment-consumption",
      deltaQuantity: "-2",
      beforeQuantity: "14",
      afterQuantity: "12",
      appointmentId: "deleted-appointment",
      appointmentDeleted: true,
    };
    const current = {
      ...emptyData(),
      inventoryItems: [item],
      inventoryMovements: [consumption],
    };

    expect(() =>
      applyBusinessDataMutation(
        current,
        {
          kind: "upsert-inventory-item",
          item: { ...item, unit: "瓶" },
          expectedUpdatedAt: item.updatedAt,
        },
        NOW,
      ),
    ).toThrow("不能修改计量单位");
  });

  it("库存调整只更新最新物品的数量，不覆盖并发保存的资料和状态", () => {
    const latestItem = {
      ...item,
      name: "精华液（新资料）",
      note: "刚保存的说明",
      status: "inactive" as const,
      currentQuantity: "10",
      updatedAt: "2026-08-08T08:45:00.000Z",
    };
    const staleAdjustmentItem = {
      ...item,
      name: "精华液",
      currentQuantity: "12",
      updatedAt: "2026-08-08T09:00:00.000Z",
    };
    const next = applyBusinessDataMutation(
      { ...emptyData(), inventoryItems: [latestItem] },
      {
        kind: "commit-inventory-adjustment",
        item: staleAdjustmentItem,
        movement,
      },
      NOW,
    );

    expect(next.inventoryItems[0]).toMatchObject({
      name: "精华液（新资料）",
      note: "刚保存的说明",
      status: "inactive",
      currentQuantity: "12",
    });
  });

  it("删除未被引用物品时同时清理其手工变动", () => {
    const initialMovement: InventoryMovementV1 = {
      ...movement,
      type: "initial",
      beforeQuantity: "0",
      deltaQuantity: "12",
    };
    const current = applyBusinessDataMutation(
      emptyData(),
      { kind: "commit-inventory-adjustment", item, movement: initialMovement },
      NOW,
    );

    const next = applyBusinessDataMutation(
      current,
      { kind: "delete-unreferenced-inventory-item", inventoryItemId: item.id },
      NOW,
    );

    expect(next.inventoryItems).toEqual([]);
    expect(next.inventoryMovements).toEqual([]);
  });

  it("有项目引用时拒绝删除物品，未进入预约的项目可删除", () => {
    const withItem = applyBusinessDataMutation(
      emptyData(),
      { kind: "upsert-inventory-item", item },
      NOW,
    );
    const withProject = applyBusinessDataMutation(
      withItem,
      { kind: "upsert-beauty-project", project },
      NOW,
    );

    expect(() =>
      applyBusinessDataMutation(
        withProject,
        {
          kind: "delete-unreferenced-inventory-item",
          inventoryItemId: item.id,
        },
        NOW,
      ),
    ).toThrow("只能停用");
    expect(
      applyBusinessDataMutation(
        withProject,
        {
          kind: "delete-unreferenced-beauty-project",
          projectId: project.id,
        },
        NOW,
      ).projects,
    ).toEqual([]);
  });

  it("手工变动重放原子替换物品数量与该物品变动链", () => {
    const withItem = applyBusinessDataMutation(
      emptyData(),
      {
        kind: "upsert-inventory-item",
        item: { ...item, currentQuantity: "10" },
      },
      NOW,
    );
    const current = applyBusinessDataMutation(
      withItem,
      { kind: "commit-inventory-adjustment", item, movement },
      NOW,
    );
    const rewrittenMovement = {
      ...movement,
      deltaQuantity: "3",
      afterQuantity: "13",
    };

    const next = applyBusinessDataMutation(
      current,
      {
        kind: "rewrite-manual-inventory-movements",
        item: { ...item, currentQuantity: "13" },
        movements: [rewrittenMovement],
        expectedMovements: [{ id: movement.id, updatedAt: movement.updatedAt }],
      },
      NOW,
    );

    expect(next.inventoryItems[0]?.currentQuantity).toBe("13");
    expect(next.inventoryMovements[0]).toMatchObject({
      ...rewrittenMovement,
      updatedAt: expect.any(String),
    });
    expect(
      next.inventoryMovements[0]!.updatedAt > rewrittenMovement.updatedAt,
    ).toBe(true);
  });

  it("手工变动重放拒绝删除读取后并发新增的库存记录", () => {
    const concurrentMovement: InventoryMovementV1 = {
      ...movement,
      id: "movement-concurrent",
      beforeQuantity: "12",
      deltaQuantity: "1",
      afterQuantity: "13",
      updatedAt: "2026-08-08T09:30:00.000Z",
    };
    const current = {
      ...emptyData(),
      inventoryItems: [{ ...item, currentQuantity: "13" }],
      inventoryMovements: [movement, concurrentMovement],
    };

    expect(() =>
      applyBusinessDataMutation(
        current,
        {
          kind: "rewrite-manual-inventory-movements",
          item,
          movements: [movement],
          expectedMovements: [
            { id: movement.id, updatedAt: movement.updatedAt },
          ],
        },
        NOW,
      ),
    ).toThrow("已被其他操作更新");
    expect(current.inventoryMovements).toHaveLength(2);
  });

  it("项目和顾客更新使用读取版本，拒绝资料与状态互相覆盖", () => {
    const current = {
      ...emptyData(),
      inventoryItems: [item],
      projects: [{ ...project, updatedAt: "2026-08-08T09:30:00.000Z" }],
      customers: [{ ...customer, updatedAt: "2026-08-08T09:30:00.000Z" }],
    };

    expect(() =>
      applyBusinessDataMutation(
        current,
        {
          kind: "upsert-beauty-project",
          project: { ...project, name: "旧草稿名称" },
          expectedUpdatedAt: project.updatedAt,
        },
        NOW,
      ),
    ).toThrow("服务项目已被其他操作更新");
    expect(() =>
      applyBusinessDataMutation(
        current,
        {
          kind: "upsert-customer",
          customer: { ...customer, nickname: "旧草稿昵称" },
          expectedUpdatedAt: customer.updatedAt,
        },
        NOW,
      ),
    ).toThrow("顾客资料已被其他操作更新");
  });

  it("新增预约按队列内最新占用复核库存，不接受过时可用数量", () => {
    const existingAppointment = {
      id: "appointment-existing",
      customerId: customer.id,
      projectSnapshots: [
        {
          projectId: project.id,
          name: project.name,
          standardPriceCents: project.standardPriceCents,
          durationMinutes: project.durationMinutes,
        },
      ],
      standardAmountCents: project.standardPriceCents,
      estimatedDurationMinutes: project.durationMinutes,
      actualUsages: [
        {
          inventoryItemId: item.id,
          itemNameSnapshot: item.name,
          unitSnapshot: item.unit,
          quantity: "8",
        },
      ],
      scheduledAt: NOW,
      serviceAddressSnapshot: { addressText: "已有预约地址" },
      status: "pending" as const,
      createdAt: NOW,
      updatedAt: NOW,
      schemaVersion: 1 as const,
    };
    const candidateAppointment = {
      ...existingAppointment,
      id: "appointment-new",
      actualUsages: [
        {
          ...existingAppointment.actualUsages[0],
          quantity: "5",
        },
      ],
      serviceAddressSnapshot: { addressText: "新预约地址" },
    };
    const current = {
      ...emptyData(),
      inventoryItems: [item],
      projects: [project],
      customers: [customer],
      appointments: [existingAppointment],
    };

    expect(() =>
      applyBusinessDataMutation(
        current,
        {
          kind: "upsert-pending-appointment",
          appointment: candidateAppointment,
          expectedReferences: {
            customerUpdatedAt: customer.updatedAt,
            projects: [{ id: project.id, updatedAt: project.updatedAt }],
            inventoryItems: [{ id: item.id, updatedAt: item.updatedAt }],
          },
        },
        NOW,
      ),
    ).toThrow("可用库存不足");
  });

  it("新增预约拒绝使用读取后已变化的项目快照", () => {
    const latestProject = {
      ...project,
      name: "补水护理（新名称）",
      updatedAt: "2026-08-08T09:30:00.000Z",
    };
    const appointment = {
      id: "appointment-new",
      customerId: customer.id,
      projectSnapshots: [
        {
          projectId: project.id,
          name: project.name,
          standardPriceCents: project.standardPriceCents,
          durationMinutes: project.durationMinutes,
        },
      ],
      standardAmountCents: project.standardPriceCents,
      estimatedDurationMinutes: project.durationMinutes,
      actualUsages: [],
      scheduledAt: NOW,
      serviceAddressSnapshot: { addressText: "测试地址" },
      status: "pending" as const,
      createdAt: NOW,
      updatedAt: NOW,
      schemaVersion: 1 as const,
    };

    expect(() =>
      applyBusinessDataMutation(
        {
          ...emptyData(),
          inventoryItems: [item],
          projects: [latestProject],
          customers: [customer],
        },
        {
          kind: "upsert-pending-appointment",
          appointment,
          expectedReferences: {
            customerUpdatedAt: customer.updatedAt,
            projects: [{ id: project.id, updatedAt: project.updatedAt }],
            inventoryItems: [],
          },
        },
        NOW,
      ),
    ).toThrow("服务项目资料已变化");
  });

  it("手工变动重放不能篡改预约消耗记录", () => {
    const appointmentMovement: InventoryMovementV1 = {
      ...movement,
      id: "appointment-movement",
      type: "appointment-consumption",
      beforeQuantity: "12",
      deltaQuantity: "-2",
      afterQuantity: "10",
      appointmentId: "deleted-appointment",
      appointmentDeleted: true,
    };
    const current = {
      ...emptyData(),
      inventoryItems: [{ ...item, currentQuantity: "10" }],
      inventoryMovements: [appointmentMovement],
    };

    expect(() =>
      applyBusinessDataMutation(
        current,
        {
          kind: "rewrite-manual-inventory-movements",
          item: { ...item, currentQuantity: "9" },
          movements: [
            { ...appointmentMovement, deltaQuantity: "-3", afterQuantity: "9" },
          ],
          expectedMovements: [
            { id: appointmentMovement.id, updatedAt: appointmentMovement.updatedAt },
          ],
        },
        NOW,
      ),
    ).toThrow("预约消耗记录不能");
  });

  it("手工记录变化时允许重算预约消耗的前后结余但保持消耗差额", () => {
    const initialMovement: InventoryMovementV1 = {
      id: "initial-movement",
      inventoryItemId: "item-1",
      type: "initial",
      beforeQuantity: "0",
      deltaQuantity: "10",
      afterQuantity: "10",
      occurredAt: "2026-08-08T08:00:00.000Z",
      appointmentDeleted: false,
      createdAt: NOW,
      updatedAt: NOW,
      schemaVersion: 1,
    };
    const appointmentMovement: InventoryMovementV1 = {
      id: "appointment-movement",
      inventoryItemId: "item-1",
      type: "appointment-consumption",
      beforeQuantity: "10",
      deltaQuantity: "-2",
      afterQuantity: "8",
      occurredAt: "2026-08-08T09:00:00.000Z",
      appointmentId: "deleted-appointment",
      appointmentDeleted: true,
      createdAt: NOW,
      updatedAt: NOW,
      schemaVersion: 1,
    };
    const current = {
      ...emptyData(),
      inventoryItems: [{ ...item, currentQuantity: "8" }],
      inventoryMovements: [initialMovement, appointmentMovement],
    };

    const next = applyBusinessDataMutation(
      current,
      {
        kind: "rewrite-manual-inventory-movements",
        item: { ...item, currentQuantity: "10" },
        movements: [
          {
            ...initialMovement,
            deltaQuantity: "12",
            afterQuantity: "12",
          },
          {
            ...appointmentMovement,
            beforeQuantity: "12",
            afterQuantity: "10",
          },
        ],
        expectedMovements: [initialMovement, appointmentMovement].map(
          ({ id, updatedAt }) => ({ id, updatedAt }),
        ),
      },
      NOW,
    );

    expect(next.inventoryMovements[1]).toMatchObject({
      beforeQuantity: "12",
      deltaQuantity: "-2",
      afterQuantity: "10",
    });
  });

  it("取消待执行预约只释放派生占用，不修改库存或新增变动", () => {
    const appointment = createPendingAppointment();
    const current = {
      ...emptyData(),
      inventoryItems: [item],
      projects: [project],
      customers: [customer],
      appointments: [appointment],
    };

    const next = applyBusinessDataMutation(
      current,
      {
        kind: "cancel-pending-appointment",
        appointmentId: appointment.id,
        expectedUpdatedAt: appointment.updatedAt,
        cancelledAt: NOW,
        cancelReason: " 临时有事 ",
        updatedAt: NOW,
      },
      NOW,
    );

    expect(next.appointments[0]).toMatchObject({
      status: "cancelled",
      cancelledAt: NOW,
      cancelReason: "临时有事",
    });
    expect(next.inventoryItems).toEqual(current.inventoryItems);
    expect(next.inventoryMovements).toEqual([]);
  });

  it("恢复取消按最新库存重新占用，不足时保持已取消", () => {
    const appointment = createPendingAppointment();
    const cancelledData = applyBusinessDataMutation(
      {
        ...emptyData(),
        inventoryItems: [item],
        projects: [project],
        customers: [customer],
        appointments: [appointment],
      },
      {
        kind: "cancel-pending-appointment",
        appointmentId: appointment.id,
        expectedUpdatedAt: appointment.updatedAt,
        cancelledAt: NOW,
        updatedAt: NOW,
      },
      NOW,
    );
    const cancelled = cancelledData.appointments[0]!;
    const occupying = createPendingAppointment({
      id: "appointment-occupying",
      actualUsages: [
        {
          inventoryItemId: item.id,
          itemNameSnapshot: item.name,
          unitSnapshot: item.unit,
          quantity: "11",
        },
      ],
    });

    expect(() =>
      applyBusinessDataMutation(
        {
          ...cancelledData,
          appointments: [cancelled, occupying],
        },
        {
          kind: "restore-cancelled-appointment",
          appointmentId: cancelled.id,
          expectedUpdatedAt: cancelled.updatedAt,
          updatedAt: NOW,
        },
        NOW,
      ),
    ).toThrow("缺少 1毫升");
    expect(cancelled.status).toBe("cancelled");

    const restored = applyBusinessDataMutation(
      cancelledData,
      {
        kind: "restore-cancelled-appointment",
        appointmentId: cancelled.id,
        expectedUpdatedAt: cancelled.updatedAt,
        updatedAt: NOW,
      },
      NOW,
    ).appointments[0]!;
    expect(restored.status).toBe("pending");
    expect(restored).not.toHaveProperty("cancelledAt");
    expect(restored).not.toHaveProperty("cancelReason");
  });

  it("完成预约原子扣减库存并生成预约消耗记录", () => {
    const appointment = createPendingAppointment();
    const actualUsages = [
      {
        ...appointment.actualUsages[0]!,
        quantity: "3",
      },
    ];

    const next = applyBusinessDataMutation(
      {
        ...emptyData(),
        inventoryItems: [item],
        projects: [project],
        customers: [customer],
        appointments: [appointment],
      },
      {
        kind: "complete-pending-appointment",
        appointmentId: appointment.id,
        expectedUpdatedAt: appointment.updatedAt,
        actualUsages,
        transactionAmountCents: 8200,
        completedAt: NOW,
        note: " 实际完成 ",
        updatedAt: NOW,
        movementIds: [
          { inventoryItemId: item.id, movementId: "movement-consumption-1" },
        ],
      },
      NOW,
    );

    expect(next.appointments[0]).toMatchObject({
      status: "completed",
      transactionAmountCents: 8200,
      completedAt: NOW,
      note: "实际完成",
      actualUsages,
    });
    expect(next.inventoryItems[0]?.currentQuantity).toBe("9");
    expect(next.inventoryMovements).toEqual([
      expect.objectContaining({
        id: "movement-consumption-1",
        type: "appointment-consumption",
        beforeQuantity: "12",
        deltaQuantity: "-3",
        afterQuantity: "9",
        appointmentId: appointment.id,
        appointmentDeleted: false,
      }),
    ]);
  });

  it("回填完成时间时按业务时间插入消耗并保留后续盘点实际库存", () => {
    const appointment = createPendingAppointment();
    const initialMovement: InventoryMovementV1 = {
      id: "movement-initial",
      inventoryItemId: item.id,
      type: "initial",
      beforeQuantity: "0",
      deltaQuantity: "10",
      afterQuantity: "10",
      occurredAt: "2026-08-08T08:00:00.000Z",
      appointmentDeleted: false,
      createdAt: "2026-08-08T08:00:00.000Z",
      updatedAt: "2026-08-08T08:00:00.000Z",
      schemaVersion: 1,
    };
    const stocktakeMovement: InventoryMovementV1 = {
      id: "movement-stocktake",
      inventoryItemId: item.id,
      type: "stocktake",
      beforeQuantity: "10",
      deltaQuantity: "2",
      afterQuantity: "12",
      occurredAt: "2026-08-08T10:00:00.000Z",
      appointmentDeleted: false,
      createdAt: "2026-08-08T10:00:00.000Z",
      updatedAt: "2026-08-08T10:00:00.000Z",
      schemaVersion: 1,
    };

    const next = applyBusinessDataMutation(
      {
        ...emptyData(),
        inventoryItems: [item],
        inventoryMovements: [initialMovement, stocktakeMovement],
        projects: [project],
        customers: [customer],
        appointments: [appointment],
      },
      {
        kind: "complete-pending-appointment",
        appointmentId: appointment.id,
        expectedUpdatedAt: appointment.updatedAt,
        actualUsages: [
          { ...appointment.actualUsages[0]!, quantity: "3" },
        ],
        transactionAmountCents: 8800,
        completedAt: "2026-08-08T09:00:00.000Z",
        updatedAt: NOW,
        movementIds: [
          { inventoryItemId: item.id, movementId: "movement-consumption-1" },
        ],
      },
      NOW,
    );

    expect(next.inventoryItems[0]?.currentQuantity).toBe("12");
    expect(next.inventoryMovements).toEqual([
      initialMovement,
      expect.objectContaining({
        id: "movement-consumption-1",
        beforeQuantity: "10",
        deltaQuantity: "-3",
        afterQuantity: "7",
      }),
      expect.objectContaining({
        id: "movement-stocktake",
        beforeQuantity: "7",
        deltaQuantity: "5",
        afterQuantity: "12",
      }),
    ]);
  });

  it("撤销完成移除预约消耗、补回库存并恢复待执行占用", () => {
    const appointment = createPendingAppointment();
    const completedData = applyBusinessDataMutation(
      {
        ...emptyData(),
        inventoryItems: [item],
        projects: [project],
        customers: [customer],
        appointments: [appointment],
      },
      {
        kind: "complete-pending-appointment",
        appointmentId: appointment.id,
        expectedUpdatedAt: appointment.updatedAt,
        actualUsages: appointment.actualUsages,
        transactionAmountCents: 8800,
        completedAt: NOW,
        updatedAt: NOW,
        movementIds: [
          { inventoryItemId: item.id, movementId: "movement-consumption-1" },
        ],
      },
      NOW,
    );
    const completed = completedData.appointments[0]!;

    const reverted = applyBusinessDataMutation(
      completedData,
      {
        kind: "revert-completed-appointment",
        appointmentId: completed.id,
        expectedUpdatedAt: completed.updatedAt,
        updatedAt: NOW,
      },
      NOW,
    );

    expect(reverted.appointments[0]?.status).toBe("pending");
    expect(reverted.appointments[0]).not.toHaveProperty(
      "transactionAmountCents",
    );
    expect(reverted.appointments[0]).not.toHaveProperty("completedAt");
    expect(reverted.inventoryItems[0]?.currentQuantity).toBe("12");
    expect(reverted.inventoryMovements).toEqual([]);
  });

  it("彻底删除待执行或已取消预约不改变实际库存", () => {
    const appointment = createPendingAppointment();
    const base = {
      ...emptyData(),
      inventoryItems: [item],
      projects: [project],
      customers: [customer],
      appointments: [appointment],
    };
    const removedPending = applyBusinessDataMutation(
      base,
      {
        kind: "delete-appointment",
        appointmentId: appointment.id,
        expectedStatus: "pending",
        expectedUpdatedAt: appointment.updatedAt,
        updatedAt: NOW,
      },
      NOW,
    );
    expect(removedPending.appointments).toEqual([]);
    expect(removedPending.inventoryItems).toEqual([item]);

    const cancelledData = applyBusinessDataMutation(
      base,
      {
        kind: "cancel-pending-appointment",
        appointmentId: appointment.id,
        expectedUpdatedAt: appointment.updatedAt,
        cancelledAt: NOW,
        updatedAt: NOW,
      },
      NOW,
    );
    const cancelled = cancelledData.appointments[0]!;
    const removedCancelled = applyBusinessDataMutation(
      cancelledData,
      {
        kind: "delete-appointment",
        appointmentId: cancelled.id,
        expectedStatus: "cancelled",
        expectedUpdatedAt: cancelled.updatedAt,
        updatedAt: NOW,
      },
      NOW,
    );
    expect(removedCancelled.appointments).toEqual([]);
    expect(removedCancelled.inventoryItems).toEqual([item]);
  });

  it("删除已完成预约不补库存并保留标记来源已删除的消耗", () => {
    const appointment = createPendingAppointment();
    const completedData = applyBusinessDataMutation(
      {
        ...emptyData(),
        inventoryItems: [item],
        projects: [project],
        customers: [customer],
        appointments: [appointment],
      },
      {
        kind: "complete-pending-appointment",
        appointmentId: appointment.id,
        expectedUpdatedAt: appointment.updatedAt,
        actualUsages: [
          { ...appointment.actualUsages[0]!, quantity: "3" },
        ],
        transactionAmountCents: 8800,
        completedAt: NOW,
        updatedAt: NOW,
        movementIds: [
          { inventoryItemId: item.id, movementId: "movement-consumption-1" },
        ],
      },
      NOW,
    );
    const completed = completedData.appointments[0]!;

    const removed = applyBusinessDataMutation(
      completedData,
      {
        kind: "delete-appointment",
        appointmentId: completed.id,
        expectedStatus: "completed",
        expectedUpdatedAt: completed.updatedAt,
        updatedAt: NOW,
      },
      NOW,
    );

    expect(removed.appointments).toEqual([]);
    expect(removed.inventoryItems[0]?.currentQuantity).toBe("9");
    expect(removed.inventoryMovements).toEqual([
      expect.objectContaining({
        id: "movement-consumption-1",
        appointmentId: appointment.id,
        appointmentDeleted: true,
      }),
    ]);
  });

  it("更正完成不能把旧消耗标识复用到另一库存物品", () => {
    const appointment = createPendingAppointment();
    const completedData = applyBusinessDataMutation(
      {
        ...emptyData(),
        inventoryItems: [item],
        projects: [project],
        customers: [customer],
        appointments: [appointment],
      },
      {
        kind: "complete-pending-appointment",
        appointmentId: appointment.id,
        expectedUpdatedAt: appointment.updatedAt,
        actualUsages: appointment.actualUsages,
        transactionAmountCents: 8800,
        completedAt: NOW,
        updatedAt: NOW,
        movementIds: [
          { inventoryItemId: item.id, movementId: "movement-consumption-1" },
        ],
      },
      NOW,
    );
    const completed = completedData.appointments[0]!;
    const otherItem: InventoryItemV1 = {
      ...item,
      id: "item-2",
      name: "面膜",
      unit: "片",
      unitKind: "discrete",
      currentQuantity: "5",
    };

    expect(() =>
      applyBusinessDataMutation(
        {
          ...completedData,
          inventoryItems: [...completedData.inventoryItems, otherItem],
        },
        {
          kind: "correct-completed-appointment",
          appointmentId: completed.id,
          expectedUpdatedAt: completed.updatedAt,
          actualUsages: [
            {
              inventoryItemId: otherItem.id,
              itemNameSnapshot: otherItem.name,
              unitSnapshot: otherItem.unit,
              quantity: "1",
            },
          ],
          transactionAmountCents: 8800,
          completedAt: NOW,
          updatedAt: NOW,
          movementIds: [
            {
              inventoryItemId: otherItem.id,
              movementId: "movement-consumption-1",
            },
          ],
        },
        NOW,
      ),
    ).toThrow("标识无效");
  });

  it("完成预约按最新其他待执行占用复核，失败不修改输入快照", () => {
    const appointment = createPendingAppointment();
    const occupying = createPendingAppointment({
      id: "appointment-occupying",
      actualUsages: [
        {
          ...appointment.actualUsages[0]!,
          quantity: "10",
        },
      ],
    });
    const current = {
      ...emptyData(),
      inventoryItems: [item],
      projects: [project],
      customers: [customer],
      appointments: [appointment, occupying],
    };

    expect(() =>
      applyBusinessDataMutation(
        current,
        {
          kind: "complete-pending-appointment",
          appointmentId: appointment.id,
          expectedUpdatedAt: appointment.updatedAt,
          actualUsages: [
            { ...appointment.actualUsages[0]!, quantity: "3" },
          ],
          transactionAmountCents: 8800,
          completedAt: NOW,
          updatedAt: NOW,
          movementIds: [
            { inventoryItemId: item.id, movementId: "movement-consumption-1" },
          ],
        },
        NOW,
      ),
    ).toThrow("完成后还缺少 1毫升");
    expect(current.inventoryItems[0]?.currentQuantity).toBe("12");
    expect(current.inventoryMovements).toEqual([]);
    expect(current.appointments[0]?.status).toBe("pending");
  });
});
