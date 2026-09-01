import { describe, expect, it, vi } from "vitest";
import {
  completeCustomerCreateNavigation,
  refreshCustomerListOnShow,
} from "./customer-create-navigation";

describe("独立新增顾客页面交接", () => {
  it("保存成功后先反馈再返回顾客列表", () => {
    const showToast = vi.fn();
    const navigateBack = vi.fn();

    completeCustomerCreateNavigation({ showToast, navigateBack });

    expect(showToast).toHaveBeenCalledWith({
      title: "顾客资料已保存",
      icon: "success",
    });
    expect(navigateBack).toHaveBeenCalledOnce();
    expect(showToast.mock.invocationCallOrder[0]).toBeLessThan(
      navigateBack.mock.invocationCallOrder[0],
    );
  });

  it("返回后的页面显示会刷新列表，首次挂载前允许没有目标", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);

    await refreshCustomerListOnShow({ refresh });
    await refreshCustomerListOnShow();

    expect(refresh).toHaveBeenCalledOnce();
  });
});
