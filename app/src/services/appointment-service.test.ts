import { describe, expect, it } from "vitest";
import type {
  AppointmentV1,
  BeautyProjectV1,
  CustomerV1,
  InventoryItemV1,
} from "@/domain/data-schema";
import {
  findAppointmentConflicts,
  preparePendingAppointment,
} from "./appointment-service";

const NOW = "2026-08-08T10:00:00.000Z";
const customer: CustomerV1 = {
  id: "customer-1",
  nickname: "小雨",
  phone: "13800138000",
  addresses: [],
  status: "active",
  createdAt: NOW,
  updatedAt: NOW,
  schemaVersion: 1,
};
const items: InventoryItemV1[] = [
  {
    id: "item-1",
    name: "精华液",
    unit: "毫升",
    unitKind: "continuous",
    currentQuantity: "10",
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
    schemaVersion: 1,
  },
  {
    id: "item-2",
    name: "面膜",
    unit: "片",
    unitKind: "discrete",
    currentQuantity: "5",
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
    schemaVersion: 1,
  },
];
const projects: BeautyProjectV1[] = [
  {
    id: "project-1",
    name: "补水护理",
    standardPriceCents: 8800,
    durationMinutes: 60,
    defaultUsages: [
      { inventoryItemId: "item-1", quantity: "1.5" },
      { inventoryItemId: "item-2", quantity: "1" },
    ],
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
    schemaVersion: 1,
  },
  {
    id: "project-2",
    name: "肩颈护理",
    standardPriceCents: 6800,
    durationMinutes: 30,
    defaultUsages: [{ inventoryItemId: "item-1", quantity: "0.5" }],
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
    schemaVersion: 1,
  },
];

function createPendingAppointment(
  overrides: Partial<AppointmentV1> = {},
): AppointmentV1 {
  return {
    id: "appointment-existing",
    customerId: customer.id,
    projectSnapshots: [
      {
        projectId: projects[0]!.id,
        name: projects[0]!.name,
        standardPriceCents: projects[0]!.standardPriceCents,
        durationMinutes: projects[0]!.durationMinutes,
      },
    ],
    standardAmountCents: 8800,
    estimatedDurationMinutes: 60,
    actualUsages: [
      {
        inventoryItemId: "item-1",
        itemNameSnapshot: "精华液",
        unitSnapshot: "毫升",
        quantity: "2.29",
      },
    ],
    scheduledAt: "2026-08-09T10:00:00.000Z",
    serviceAddressSnapshot: { addressText: "建设路 8 号" },
    status: "pending",
    createdAt: NOW,
    updatedAt: NOW,
    schemaVersion: 1,
    ...overrides,
  } as AppointmentV1;
}

describe("待执行预约业务规则", () => {
  it("合并多项目快照、金额、时长和相同物品默认用量", () => {
    const prepared = preparePendingAppointment({
      customerId: customer.id,
      projectIds: ["project-1", "project-2"],
      scheduledAt: "2026-08-09T08:00:00.000Z",
      serviceAddress: { addressText: " 建设路 8 号 ", note: " 东门 " },
      note: " 先做肩颈 ",
      customers: [customer],
      projects,
      inventoryItems: items,
      appointments: [],
    });

    expect(prepared).toMatchObject({
      standardAmountCents: 15600,
      estimatedDurationMinutes: 90,
      actualUsages: [
        { inventoryItemId: "item-1", quantity: "2" },
        { inventoryItemId: "item-2", quantity: "1" },
      ],
      serviceAddressSnapshot: { addressText: "建设路 8 号", note: "东门" },
      note: "先做肩颈",
    });
  });

  it("本次实际用量完全覆盖项目默认用量并保存物品快照", () => {
    const prepared = preparePendingAppointment({
      customerId: customer.id,
      projectIds: ["project-1"],
      actualUsageInputs: [
        { inventoryItemId: "item-1", quantityInput: "2.25" },
      ],
      scheduledAt: "2026-08-09T08:00:00.000Z",
      serviceAddress: { addressText: "建设路 8 号" },
      customers: [customer],
      projects,
      inventoryItems: items,
      appointments: [],
    });

    expect(prepared.actualUsages).toEqual([
      {
        inventoryItemId: "item-1",
        itemNameSnapshot: "精华液",
        unitSnapshot: "毫升",
        quantity: "2.25",
      },
    ]);
  });

  it("拒绝停用顾客、重复项目和不足库存", () => {
    const base = {
      customerId: customer.id,
      projectIds: ["project-1"],
      scheduledAt: "2026-08-09T08:00:00.000Z",
      serviceAddress: { addressText: "建设路 8 号" },
      customers: [customer],
      projects,
      inventoryItems: items,
      appointments: [] as AppointmentV1[],
    };
    expect(() =>
      preparePendingAppointment({
        ...base,
        customers: [{ ...customer, status: "inactive" }],
      }),
    ).toThrow("不存在或已停用");
    expect(() =>
      preparePendingAppointment({
        ...base,
        projectIds: ["project-1", "project-1"],
      }),
    ).toThrow("不能重复选择");
    expect(() =>
      preparePendingAppointment({
        ...base,
        actualUsageInputs: [
          { inventoryItemId: "item-1", quantityInput: "8" },
        ],
        appointments: [createPendingAppointment()],
      }),
    ).toThrow("库存不足，缺少 0.29毫升");
  });

  it("编辑预约时排除自身占用，但仍计算其他待执行预约", () => {
    const existing = createPendingAppointment();
    expect(() =>
      preparePendingAppointment({
        customerId: customer.id,
        projectIds: ["project-1"],
        actualUsageInputs: [
          { inventoryItemId: "item-1", quantityInput: "10" },
        ],
        scheduledAt: existing.scheduledAt,
        serviceAddress: existing.serviceAddressSnapshot,
        customers: [customer],
        projects,
        inventoryItems: items,
        appointments: [existing],
        editingAppointmentId: existing.id,
      }),
    ).not.toThrow();
  });

  it("只报告待执行预约的真实时间重叠，首尾相接不冲突", () => {
    const pending = createPendingAppointment();
    const cancelled = createPendingAppointment({
      id: "appointment-cancelled",
      status: "cancelled",
      cancelledAt: NOW,
    });

    expect(
      findAppointmentConflicts(
        "2026-08-09T10:30:00.000Z",
        60,
        [pending, cancelled],
      ),
    ).toEqual([
      {
        appointmentId: pending.id,
        scheduledAt: pending.scheduledAt,
      },
    ]);
    expect(
      findAppointmentConflicts(
        "2026-08-09T11:00:00.000Z",
        30,
        [pending],
      ),
    ).toEqual([]);
  });
});
