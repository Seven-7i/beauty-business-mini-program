import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { useCustomerDetailTabs } from "./composables/useCustomerManagement";

/** 读取顾客详情组件源码，锁定跨实体一致的操作图标层级。 */
function readSource(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("顾客详情页签", () => {
  it("默认展示顾客资料，并可在两个内容区之间切换", () => {
    const tabs = useCustomerDetailTabs();

    expect(tabs.activeTab.value).toBe("profile");
    tabs.selectTab("history");
    expect(tabs.activeTab.value).toBe("history");
    tabs.selectTab("profile");
    expect(tabs.activeTab.value).toBe("profile");
  });

  it("资料操作与服务项目和物品详情使用一致的语义图标", () => {
    const profile = readSource("./components/CustomerProfileDetails.vue");

    expect(profile).toContain(
      ":name=\"customer.status === 'active' ? 'pause-circle' : 'play-circle'\"",
    );
    expect(profile).toContain(
      '<u-icon name="trash" color="#D92E56" size="20" />',
    );
    expect(
      profile.match(/name="arrow-right" color="#817A80" size="16"/g),
    ).toHaveLength(2);
  });
});
