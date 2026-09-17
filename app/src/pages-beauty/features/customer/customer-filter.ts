import type { CustomerV1 } from "@/domain/data-schema";

/**
 * 顾客列表按确认稿切换互斥的启用/停用范围，并在当前范围内匹配昵称或手机号。
 * 当前由 CustomerList 调用；返回新数组，不改变 composable 提供的原始排序。
 */
export function filterCustomers<
  TCustomer extends Pick<CustomerV1, "nickname" | "phone" | "status">,
>(
  customers: readonly TCustomer[],
  keyword: string,
  inactiveOnly: boolean,
): TCustomer[] {
  const query = keyword.trim();
  const visibleStatus: CustomerV1["status"] = inactiveOnly
    ? "inactive"
    : "active";
  return customers.filter(
    (customer) =>
      customer.status === visibleStatus &&
      (!query ||
        customer.nickname.includes(query) ||
        customer.phone.includes(query)),
  );
}
