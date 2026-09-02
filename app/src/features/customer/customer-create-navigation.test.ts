import { describe, expect, it, vi } from "vitest";
import {
  buildCustomerEditorUrl,
  completeCustomerEditorNavigation,
  createCustomerEditorCompletionGuard,
  CUSTOMER_SAVED_EVENT,
  notifyCustomerSaved,
  openCustomerEditor,
  readCustomerEditorId,
  refreshCustomerListOnShow,
  subscribeCustomerSaved,
} from "./customer-create-navigation";

describe("统一顾客表单页导航", () => {
  it("新增使用基础地址，编辑只附加编码后的稳定顾客标识", () => {
    expect(buildCustomerEditorUrl()).toBe("/pages/customer-create/index");
    expect(buildCustomerEditorUrl("customer/张女士")).toBe(
      "/pages/customer-create/index?customerId=customer%2F%E5%BC%A0%E5%A5%B3%E5%A3%AB",
    );
    expect(readCustomerEditorId()).toBe("");
    expect(readCustomerEditorId({ customerId: " customer-1 " })).toBe(
      "customer-1",
    );
  });

  it("列表和详情通过同一导航入口打开对应表单模式", () => {
    const navigateTo = vi.fn();

    openCustomerEditor("", { navigateTo });
    openCustomerEditor("customer-1", { navigateTo });

    expect(navigateTo).toHaveBeenNthCalledWith(1, {
      url: "/pages/customer-create/index",
    });
    expect(navigateTo).toHaveBeenNthCalledWith(2, {
      url: "/pages/customer-create/index?customerId=customer-1",
    });
  });

  it("普通入口保存成功后先反馈再返回原列表或详情", () => {
    const showToast = vi.fn();
    const navigateBack = vi.fn();
    const reLaunch = vi.fn();

    completeCustomerEditorNavigation(
      "customer-1",
      { showToast, navigateBack, reLaunch },
      2,
    );

    expect(showToast).toHaveBeenCalledWith({
      title: "顾客资料已保存",
      icon: "success",
    });
    expect(navigateBack).toHaveBeenCalledOnce();
    expect(reLaunch).not.toHaveBeenCalled();
    expect(showToast.mock.invocationCallOrder[0]).toBeLessThan(
      navigateBack.mock.invocationCallOrder[0],
    );
  });

  it("深链根页面保存后回到对应的详情或列表", () => {
    const runtime = {
      showToast: vi.fn(),
      navigateBack: vi.fn(),
      reLaunch: vi.fn(),
    };

    completeCustomerEditorNavigation("customer-1", runtime, 1);
    expect(runtime.reLaunch).toHaveBeenLastCalledWith({
      url: "/pages/customer-detail/index?customerId=customer-1",
    });

    completeCustomerEditorNavigation("", runtime, 1);
    expect(runtime.reLaunch).toHaveBeenLastCalledWith({
      url: "/pages/customer/index",
    });
  });

  it("返回后的页面显示会刷新列表，首次挂载前允许没有目标", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);

    await refreshCustomerListOnShow({ refresh });
    await refreshCustomerListOnShow();

    expect(refresh).toHaveBeenCalledOnce();
  });

  it("保存完成事件会携带顾客标识，并可在页面卸载时对称取消订阅", () => {
    const listeners = new Map<string, (payload: { customerId: string }) => void>();
    const runtime = {
      $emit: vi.fn((event: string, payload: { customerId: string }) => {
        listeners.get(event)?.(payload);
      }),
      $on: vi.fn(
        (event: string, listener: (payload: { customerId: string }) => void) => {
          listeners.set(event, listener);
        },
      ),
      $off: vi.fn(
        (event: string, listener: (payload: { customerId: string }) => void) => {
          if (listeners.get(event) === listener) {
            listeners.delete(event);
          }
        },
      ),
    };
    const listener = vi.fn();
    const stop = subscribeCustomerSaved(listener, runtime);

    notifyCustomerSaved("customer-1", runtime);
    expect(listener).toHaveBeenCalledWith({ customerId: "customer-1" });
    expect(runtime.$emit).toHaveBeenCalledWith(CUSTOMER_SAVED_EVENT, {
      customerId: "customer-1",
    });

    stop();
    notifyCustomerSaved("customer-1", runtime);
    expect(listener).toHaveBeenCalledOnce();
    expect(runtime.$off).toHaveBeenCalledWith(CUSTOMER_SAVED_EVENT, listener);
  });

  it("页面卸载后关闭异步保存完成动作，避免再次触发返回导航", () => {
    const guard = createCustomerEditorCompletionGuard();

    expect(guard.isActive()).toBe(true);
    guard.deactivate();
    expect(guard.isActive()).toBe(false);
  });
});
