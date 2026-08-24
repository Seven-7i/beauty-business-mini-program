import { describe, expect, it } from "vitest";
import type {
  AppointmentV1,
  InventoryItemV1,
  InventoryMovementV1,
} from "@/domain/data-schema";
import {
  assertUniqueInventoryIdentity,
  assertInventoryItemCanBeDeleted,
  assertInventoryItemUnitCanBeChanged,
  calculateAvailableQuantity,
  calculateOccupiedQuantity,
  createInventoryAdjustment,
  rewriteManualInventoryMovement,
  InventoryRuleError,
} from "./inventory-service";

const NOW = "2026-08-08T08:30:00.000Z";

function createItem(
  overrides: Partial<InventoryItemV1> = {},
): InventoryItemV1 {
  return {
    id: "item-1",
    name: "精华液",
    unit: "毫升",
    unitKind: "continuous",
    currentQuantity: "10.5",
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
    schemaVersion: 1,
    ...overrides,
  };
}

describe("库存业务规则", () => {
  it("阻止启用物品出现重复的名称和单位", () => {
    expect(() =>
      assertUniqueInventoryIdentity(" 精华液 ", "毫升", [createItem()]),
    ).toThrow(
      new InventoryRuleError(
        "duplicate-identity",
        "已存在相同名称和单位的启用库存物品",
      ),
    );
    expect(() =>
      assertUniqueInventoryIdentity("精华液", "克", [createItem()]),
    ).not.toThrow();
  });

  it("被项目默认用量引用的库存物品只能停用", () => {
    expect(() =>
      assertInventoryItemCanBeDeleted(
        "item-1",
        [
          {
            id: "project-1",
            name: "补水护理",
            standardPriceCents: 8800,
            durationMinutes: 60,
            defaultUsages: [
              { inventoryItemId: "item-1", quantity: "1.5" },
            ],
            status: "active",
            createdAt: NOW,
            updatedAt: NOW,
            schemaVersion: 1,
          },
        ],
        [],
      ),
    ).toThrow("只能停用");
    expect(() =>
      assertInventoryItemCanBeDeleted("item-1", [], []),
    ).not.toThrow();
  });

  it("被项目或预约引用的库存物品不能修改计量单位", () => {
    const referencingProject = {
      id: "project-1",
      name: "补水护理",
      standardPriceCents: 8800,
      durationMinutes: 60,
      defaultUsages: [{ inventoryItemId: "item-1", quantity: "1" }],
      status: "active" as const,
      createdAt: NOW,
      updatedAt: NOW,
      schemaVersion: 1 as const,
    };

    expect(() =>
      assertInventoryItemUnitCanBeChanged(
        "item-1",
        [referencingProject],
        [],
      ),
    ).toThrow("不能修改计量单位");
    expect(() =>
      assertInventoryItemUnitCanBeChanged("item-2", [referencingProject], []),
    ).not.toThrow();

    const deletedAppointmentConsumption: InventoryMovementV1 = {
      id: "movement-deleted-source",
      inventoryItemId: "item-1",
      type: "appointment-consumption",
      beforeQuantity: "2",
      deltaQuantity: "-1",
      afterQuantity: "1",
      occurredAt: NOW,
      appointmentId: "deleted-appointment",
      appointmentDeleted: true,
      createdAt: NOW,
      updatedAt: NOW,
      schemaVersion: 1,
    };
    expect(() =>
      assertInventoryItemUnitCanBeChanged(
        "item-1",
        [],
        [],
        [deletedAppointmentConsumption],
      ),
    ).toThrow("不能修改计量单位");
  });

  it("补货精确增加库存并生成轻量变动记录", () => {
    const result = createInventoryAdjustment({
      item: createItem(),
      kind: "restock",
      quantityInput: "0.25",
      occupiedQuantity: "3",
      movementId: "movement-1",
      occurredAt: NOW,
      note: " 新到货 ",
    });

    expect(result.item.currentQuantity).toBe("10.75");
    expect(result.movement).toMatchObject({
      type: "restock",
      beforeQuantity: "10.5",
      deltaQuantity: "0.25",
      afterQuantity: "10.75",
      note: "新到货",
    });
  });

  it("盘点修正计算负差额，但不能低于待执行预约占用", () => {
    expect(
      createInventoryAdjustment({
        item: createItem(),
        kind: "stocktake",
        quantityInput: "4.25",
        occupiedQuantity: "4",
        movementId: "movement-1",
        occurredAt: NOW,
      }).movement.deltaQuantity,
    ).toBe("-6.25");

    expect(() =>
      createInventoryAdjustment({
        item: createItem(),
        kind: "stocktake",
        quantityInput: "3.5",
        occupiedQuantity: "4",
        movementId: "movement-2",
        occurredAt: NOW,
      }),
    ).toThrow("缺少 0.5毫升");
  });

  it("离散单位补货只能填写整数", () => {
    expect(() =>
      createInventoryAdjustment({
        item: createItem({ unit: "瓶", unitKind: "discrete", currentQuantity: "2" }),
        kind: "restock",
        quantityInput: "1.5",
        occupiedQuantity: "0",
        movementId: "movement-1",
        occurredAt: NOW,
      }),
    ).toThrow("离散单位数量必须为整数");
  });

  it("可用库存只扣除其他待执行预约占用，编辑时可排除自身", () => {
    const appointmentBase = {
      customerId: "customer-1",
      projectSnapshots: [
        {
          projectId: "project-1",
          name: "护理",
          standardPriceCents: 10000,
          durationMinutes: 60,
        },
      ],
      standardAmountCents: 10000,
      estimatedDurationMinutes: 60,
      scheduledAt: NOW,
      serviceAddressSnapshot: { addressText: "测试地址" },
      createdAt: NOW,
      updatedAt: NOW,
      schemaVersion: 1 as const,
    };
    const appointments: AppointmentV1[] = [
      {
        ...appointmentBase,
        id: "appointment-1",
        status: "pending",
        actualUsages: [
          {
            inventoryItemId: "item-1",
            itemNameSnapshot: "精华液",
            unitSnapshot: "毫升",
            quantity: "3.25",
          },
        ],
      },
      {
        ...appointmentBase,
        id: "appointment-2",
        status: "cancelled",
        cancelledAt: NOW,
        actualUsages: [
          {
            inventoryItemId: "item-1",
            itemNameSnapshot: "精华液",
            unitSnapshot: "毫升",
            quantity: "8",
          },
        ],
      },
    ];

    expect(calculateOccupiedQuantity("item-1", appointments)).toBe("3.25");
    expect(calculateAvailableQuantity(createItem(), appointments)).toBe("7.25");
    expect(
      calculateAvailableQuantity(createItem(), appointments, "appointment-1"),
    ).toBe("10.5");
  });

  it("编辑早期补货后重放后续链，并在盘点实际数处重新对齐", () => {
    const movements = [
      {
        id: "m1",
        type: "initial" as const,
        beforeQuantity: "0",
        deltaQuantity: "10",
        afterQuantity: "10",
      },
      {
        id: "m2",
        type: "restock" as const,
        beforeQuantity: "10",
        deltaQuantity: "5",
        afterQuantity: "15",
      },
      {
        id: "m3",
        type: "appointment-consumption" as const,
        beforeQuantity: "15",
        deltaQuantity: "-3",
        afterQuantity: "12",
        appointmentId: "deleted-appointment",
        appointmentDeleted: true,
      },
      {
        id: "m4",
        type: "stocktake" as const,
        beforeQuantity: "12",
        deltaQuantity: "-4",
        afterQuantity: "8",
      },
      {
        id: "m5",
        type: "restock" as const,
        beforeQuantity: "8",
        deltaQuantity: "2",
        afterQuantity: "10",
      },
    ].map((movement, index) => ({
      ...movement,
      inventoryItemId: "item-1",
      occurredAt: `2026-08-08T0${index}:00:00.000Z`,
      appointmentDeleted: movement.appointmentDeleted ?? false,
      createdAt: NOW,
      updatedAt: NOW,
      schemaVersion: 1 as const,
    }));

    const result = rewriteManualInventoryMovement({
      item: createItem({ currentQuantity: "10" }),
      movements,
      appointments: [],
      movementId: "m2",
      operation: "edit",
      quantityInput: "2",
      note: "更正到货数",
      updatedAt: NOW,
    });

    expect(result.movements.find(({ id }) => id === "m3")).toMatchObject({
      beforeQuantity: "12",
      deltaQuantity: "-3",
      afterQuantity: "9",
    });
    expect(result.movements.find(({ id }) => id === "m4")).toMatchObject({
      beforeQuantity: "9",
      deltaQuantity: "-1",
      afterQuantity: "8",
    });
    expect(result.item.currentQuantity).toBe("10");
  });

  it("预约消耗记录不能直接编辑，删除手工记录后库存不得低于占用", () => {
    const manualMovement = {
      id: "m1",
      inventoryItemId: "item-1",
      type: "initial" as const,
      beforeQuantity: "0",
      deltaQuantity: "5",
      afterQuantity: "5",
      occurredAt: NOW,
      appointmentDeleted: false,
      createdAt: NOW,
      updatedAt: NOW,
      schemaVersion: 1 as const,
    };
    const appointmentConsumption = {
      ...manualMovement,
      id: "m2",
      type: "appointment-consumption" as const,
      beforeQuantity: "5",
      deltaQuantity: "-1",
      afterQuantity: "4",
      appointmentId: "deleted-appointment",
      appointmentDeleted: true,
    };

    expect(() =>
      rewriteManualInventoryMovement({
        item: createItem({ currentQuantity: "4" }),
        movements: [manualMovement, appointmentConsumption],
        appointments: [],
        movementId: "m2",
        operation: "edit",
        quantityInput: "2",
        updatedAt: NOW,
      }),
    ).toThrow("只能通过更正对应预约");

    const pendingAppointment: AppointmentV1 = {
      id: "appointment-1",
      customerId: "customer-1",
      projectSnapshots: [
        {
          projectId: "project-1",
          name: "护理",
          standardPriceCents: 10000,
          durationMinutes: 60,
        },
      ],
      standardAmountCents: 10000,
      estimatedDurationMinutes: 60,
      actualUsages: [
        {
          inventoryItemId: "item-1",
          itemNameSnapshot: "精华液",
          unitSnapshot: "毫升",
          quantity: "1",
        },
      ],
      scheduledAt: NOW,
      serviceAddressSnapshot: { addressText: "测试地址" },
      status: "pending",
      createdAt: NOW,
      updatedAt: NOW,
      schemaVersion: 1,
    };
    expect(() =>
      rewriteManualInventoryMovement({
        item: createItem({ currentQuantity: "5" }),
        movements: [manualMovement],
        appointments: [pendingAppointment],
        movementId: "m1",
        operation: "delete",
        updatedAt: NOW,
      }),
    ).toThrow("低于待执行预约占用");
  });

  it("旧数据缺少首次入库记录时保留首条变动之前的库存基线", () => {
    const legacyMovement = {
      id: "legacy-restock",
      inventoryItemId: "item-1",
      type: "restock" as const,
      beforeQuantity: "10",
      deltaQuantity: "2",
      afterQuantity: "12",
      occurredAt: NOW,
      appointmentDeleted: false,
      createdAt: NOW,
      updatedAt: NOW,
      schemaVersion: 1 as const,
    };

    const result = rewriteManualInventoryMovement({
      item: createItem({ currentQuantity: "12" }),
      movements: [legacyMovement],
      appointments: [],
      movementId: legacyMovement.id,
      operation: "edit",
      quantityInput: "3",
      updatedAt: NOW,
    });

    expect(result.movements[0]).toMatchObject({
      beforeQuantity: "10",
      deltaQuantity: "3",
      afterQuantity: "13",
    });
    expect(result.item.currentQuantity).toBe("13");
  });
});
