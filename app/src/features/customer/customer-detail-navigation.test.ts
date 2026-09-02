import { describe, expect, it, vi } from "vitest";
import {
  buildCustomerDetailUrl,
  completeCustomerDetailDeletion,
  openCustomerDetail,
  readCustomerDetailId,
  returnToCustomerList,
} from "./customer-detail-navigation";

describe("顾客详情导航", () => {
  it("使用编码后的稳定顾客标识进入独立详情页", () => {
    const navigateTo = vi.fn();

    openCustomerDetail("customer/张女士", { navigateTo });

    expect(buildCustomerDetailUrl("customer/张女士")).toBe(
      "/pages/customer-detail/index?customerId=customer%2F%E5%BC%A0%E5%A5%B3%E5%A3%AB",
    );
    expect(navigateTo).toHaveBeenCalledWith({
      url: "/pages/customer-detail/index?customerId=customer%2F%E5%BC%A0%E5%A5%B3%E5%A3%AB",
    });
  });

  it("缺失或全空参数不会误选顾客", () => {
    expect(readCustomerDetailId()).toBe("");
    expect(readCustomerDetailId({ customerId: "   " })).toBe("");
    expect(readCustomerDetailId({ customerId: " customer-1 " })).toBe(
      "customer-1",
    );
  });

  it("彻底删除后先反馈再返回列表", () => {
    const calls: string[] = [];

    completeCustomerDetailDeletion(
      {
        showToast: vi.fn(() => calls.push("toast")),
        navigateBack: vi.fn(() => calls.push("back")),
        reLaunch: vi.fn(() => calls.push("relaunch")),
      },
      2,
    );

    expect(calls).toEqual(["toast", "back"]);
  });

  it("根页面删除顾客后反馈并重建到顾客列表", () => {
    const calls: string[] = [];

    completeCustomerDetailDeletion(
      {
        showToast: vi.fn(() => calls.push("toast")),
        navigateBack: vi.fn(() => calls.push("back")),
        reLaunch: vi.fn(() => calls.push("relaunch")),
      },
      1,
    );

    expect(calls).toEqual(["toast", "relaunch"]);
  });

  it("有上一页时返回，深链入口则重建到顾客列表", () => {
    const navigateBack = vi.fn();
    const reLaunch = vi.fn();

    returnToCustomerList(2, { navigateBack, reLaunch });
    expect(navigateBack).toHaveBeenCalledOnce();
    expect(reLaunch).not.toHaveBeenCalled();

    navigateBack.mockClear();
    returnToCustomerList(1, { navigateBack, reLaunch });
    expect(navigateBack).not.toHaveBeenCalled();
    expect(reLaunch).toHaveBeenCalledWith({ url: "/pages/customer/index" });
  });
});
