/** 将分为单位的顾客经营金额格式化为带千分位的人民币展示值。 */
export function formatCustomerCurrency(cents: number): string {
  const [integerPart, decimalPart] = (cents / 100).toFixed(2).split(".");
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `¥${groupedInteger}.${decimalPart}`;
}
