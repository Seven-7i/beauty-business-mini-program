import { describe, expect, it } from "vitest";
import type { AppointmentV1, CustomerV1 } from "@/domain/data-schema";
import {
  assertCustomerCanBeDeleted,
  normalizeCustomerInput,
} from "./customer-service";

const NOW = "2026-08-08T10:30:00.000Z";
const customer: CustomerV1 = {
  id: "customer-1",
  nickname: "小雨",
  phone: "13800138000",
  addresses: [{ id: "address-1", addressText: "朝阳路 1 号" }],
  status: "inactive",
  createdAt: NOW,
  updatedAt: NOW,
  schemaVersion: 1,
};

describe("顾客业务规则", () => {
  it("规范化昵称、手机号和多项服务地址", () => {
    expect(
      normalizeCustomerInput({
        nickname: " 小满 ",
        phone: " 13900139000 ",
        addresses: [
          { id: "address-2", addressText: " 建设路 8 号 ", note: " 东门 " },
          { id: "address-3", addressText: "幸福路 6 号", note: "   " },
        ],
        existingCustomers: [customer],
      }),
    ).toEqual({
      nickname: "小满",
      phone: "13900139000",
      addresses: [
        { id: "address-2", addressText: "建设路 8 号", note: "东门" },
        { id: "address-3", addressText: "幸福路 6 号" },
      ],
    });
  });

  it("停用顾客仍占用昵称和手机号", () => {
    expect(() =>
      normalizeCustomerInput({
        nickname: "小雨",
        phone: "13900139000",
        addresses: [],
        existingCustomers: [customer],
      }),
    ).toThrow("相同昵称");
    expect(() =>
      normalizeCustomerInput({
        nickname: "小满",
        phone: "13800138000",
        addresses: [],
        existingCustomers: [customer],
      }),
    ).toThrow("其他顾客");
  });

  it("拒绝无效大陆手机号、空地址和重复地址标识", () => {
    const base = {
      nickname: "小满",
      existingCustomers: [] as CustomerV1[],
    };
    expect(() =>
      normalizeCustomerInput({
        ...base,
        phone: "12345678901",
        addresses: [],
      }),
    ).toThrow("有效的中国大陆");
    expect(() =>
      normalizeCustomerInput({
        ...base,
        phone: "13900139000",
        addresses: [{ id: "address-1", addressText: "  " }],
      }),
    ).toThrow("服务地址正文");
    expect(() =>
      normalizeCustomerInput({
        ...base,
        phone: "13900139000",
        addresses: [
          { id: "address-1", addressText: "甲" },
          { id: "address-1", addressText: "乙" },
        ],
      }),
    ).toThrow("不能为空或重复");
  });

  it("编辑时排除自身但仍检查其他顾客", () => {
    expect(() =>
      normalizeCustomerInput({
        nickname: customer.nickname,
        phone: customer.phone,
        addresses: customer.addresses,
        existingCustomers: [customer],
        editingCustomerId: customer.id,
      }),
    ).not.toThrow();
  });

  it("已有任意状态预约记录的顾客只能停用", () => {
    const appointment: AppointmentV1 = {
      id: "appointment-1",
      customerId: customer.id,
      projectSnapshots: [],
      standardAmountCents: 0,
      estimatedDurationMinutes: 0,
      actualUsages: [],
      scheduledAt: NOW,
      serviceAddressSnapshot: { addressText: "测试地址" },
      status: "cancelled",
      cancelledAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
      schemaVersion: 1,
    };

    expect(() => assertCustomerCanBeDeleted(customer.id, [appointment])).toThrow(
      "只能停用",
    );
    expect(() => assertCustomerCanBeDeleted("customer-2", [appointment])).not.toThrow();
  });
});
