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

});
