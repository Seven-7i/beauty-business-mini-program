import { describe, expect, it, vi } from "vitest";
import {
  refreshCustomerDetailForScreen,
  shouldRefreshCustomerDetail,
} from "./composables/useCustomerManagement";

describe("顾客详情页面状态", () => {
  it("详情展示时允许刷新，编辑中返回前台时保留未保存草稿", () => {
    expect(shouldRefreshCustomerDetail("detail")).toBe(true);
    expect(shouldRefreshCustomerDetail("form")).toBe(false);
  });

  it("编辑期触发 onShow 时不会读取并替换表单使用的顾客快照", async () => {
    const refresh = vi.fn().mockResolvedValue(true);

    expect(await refreshCustomerDetailForScreen("form", refresh)).toBe(true);
    expect(refresh).not.toHaveBeenCalled();

    expect(await refreshCustomerDetailForScreen("detail", refresh)).toBe(true);
    expect(refresh).toHaveBeenCalledOnce();
  });
});
