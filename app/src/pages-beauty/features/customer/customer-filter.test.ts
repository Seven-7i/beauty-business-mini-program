import { describe, expect, it } from "vitest";
import type { CustomerV1 } from "@/domain/data-schema";
import { filterCustomers } from "./customer-filter";

/** 构造筛选测试所需的最小顾客资料。 */
function customer(
  id: string,
  nickname: string,
  phone: string,
  status: CustomerV1["status"],
): CustomerV1 {
  return {
    id,
    nickname,
    phone,
    addresses: [],
    status,
    createdAt: "2026-08-31T08:00:00.000Z",
    updatedAt: "2026-08-31T08:00:00.000Z",
    schemaVersion: 1,
  };
}

const customers = [
  customer("active-1", "张女士", "13800138000", "active"),
  customer("inactive-1", "李女士", "13900139000", "inactive"),
];

describe("filterCustomers", () => {
  it("默认只展示启用顾客", () => {
    expect(filterCustomers(customers, "", false).map(({ id }) => id)).toEqual([
      "active-1",
    ]);
  });

  it("仅看停用时只展示停用顾客", () => {
    expect(filterCustomers(customers, "", true).map(({ id }) => id)).toEqual([
      "inactive-1",
    ]);
  });

  it("只在当前状态范围内匹配昵称或手机号，并忽略首尾空格", () => {
    expect(filterCustomers(customers, " 李 ", true)).toEqual([customers[1]]);
    expect(filterCustomers(customers, "1380", true)).toEqual([]);
    expect(filterCustomers(customers, "1380", false)).toEqual([customers[0]]);
  });
});
