import type { CustomerV1 } from "@/domain/data-schema";

export type CustomerFilter = "all" | CustomerV1["status"];

/** 顾客页面实际使用的昵称/手机号与状态筛选。 */
export function filterCustomers(
  customers: readonly CustomerV1[],
  keyword: string,
  filter: CustomerFilter,
): CustomerV1[] {
  const query = keyword.trim();
  return customers.filter(
    (customer) =>
      (filter === "all" || customer.status === filter) &&
      (!query ||
        customer.nickname.includes(query) ||
        customer.phone.includes(query)),
  );
}
