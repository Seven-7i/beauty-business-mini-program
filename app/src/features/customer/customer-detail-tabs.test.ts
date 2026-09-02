import { describe, expect, it } from "vitest";
import { useCustomerDetailTabs } from "./composables/useCustomerManagement";

describe("顾客详情页签", () => {
  it("默认展示顾客资料，并可在两个内容区之间切换", () => {
    const tabs = useCustomerDetailTabs();

    expect(tabs.activeTab.value).toBe("profile");
    tabs.selectTab("history");
    expect(tabs.activeTab.value).toBe("history");
    tabs.selectTab("profile");
    expect(tabs.activeTab.value).toBe("profile");
  });
});
