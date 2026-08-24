import { describe, expect, it } from "vitest";
import type {
  AppointmentV1,
  BeautyProjectV1,
  InventoryItemV1,
} from "@/domain/data-schema";
import {
  assertBeautyProjectCanBeDeleted,
  normalizeBeautyProjectInput,
} from "./beauty-project-service";

const NOW = "2026-08-08T08:30:00.000Z";
const item: InventoryItemV1 = {
  id: "item-1",
  name: "面膜",
  unit: "片",
  unitKind: "discrete",
  currentQuantity: "10",
  status: "active",
  createdAt: NOW,
  updatedAt: NOW,
  schemaVersion: 1,
};
const project: BeautyProjectV1 = {
  id: "project-1",
  name: "补水护理",
  standardPriceCents: 8800,
  durationMinutes: 60,
  defaultUsages: [],
  status: "active",
  createdAt: NOW,
  updatedAt: NOW,
  schemaVersion: 1,
};

describe("服务项目业务规则", () => {
  it("规范化价格、时长和符合单位精度的默认用量", () => {
    expect(
      normalizeBeautyProjectInput({
        name: " 深层清洁 ",
        standardPriceInput: "128.50",
        durationMinutesInput: "90",
        defaultUsages: [{ inventoryItemId: "item-1", quantityInput: "2" }],
        inventoryItems: [item],
        existingProjects: [project],
      }),
    ).toEqual({
      name: "深层清洁",
      standardPriceCents: 12850,
      durationMinutes: 90,
      defaultUsages: [{ inventoryItemId: "item-1", quantity: "2" }],
    });
  });

  it("启用项目名称不可重复", () => {
    expect(() =>
      normalizeBeautyProjectInput({
        name: "补水护理",
        standardPriceInput: "0",
        durationMinutesInput: "30",
        defaultUsages: [],
        inventoryItems: [item],
        existingProjects: [project],
      }),
    ).toThrow("已存在同名的启用服务项目");
  });

  it("同一库存物品不能重复配置且离散单位拒绝小数", () => {
    const base = {
      name: "肩颈护理",
      standardPriceInput: "68",
      durationMinutesInput: "30",
      inventoryItems: [item],
      existingProjects: [project],
    };
    expect(() =>
      normalizeBeautyProjectInput({
        ...base,
        defaultUsages: [
          { inventoryItemId: "item-1", quantityInput: "1" },
          { inventoryItemId: "item-1", quantityInput: "2" },
        ],
      }),
    ).toThrow("不能重复配置");
    expect(() =>
      normalizeBeautyProjectInput({
        ...base,
        defaultUsages: [{ inventoryItemId: "item-1", quantityInput: "0.5" }],
      }),
    ).toThrow("离散单位数量必须为整数");
  });

  it("被历史预约快照引用的服务项目只能停用", () => {
    const appointment: AppointmentV1 = {
      id: "appointment-1",
      customerId: "customer-1",
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
      status: "cancelled",
      cancelledAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
      schemaVersion: 1,
    };

    expect(() =>
      assertBeautyProjectCanBeDeleted("project-1", [appointment]),
    ).toThrow("只能停用");
    expect(() =>
      assertBeautyProjectCanBeDeleted("project-2", [appointment]),
    ).not.toThrow();
  });
});
