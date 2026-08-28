import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("美容模块首页定稿契约", () => {
  it("按经营概览、近期预约和业务入口组合首页", () => {
    const home = readSource("./components/BeautyModuleHome.vue");
    const overview = readSource("./components/BeautyHomeOverview.vue");
    const reminders = readSource("./components/BeautyAppointmentReminders.vue");
    const entries = readSource("./components/BeautyBusinessEntryGrid.vue");

    expect(home).toContain("庄月空间 · 美容");
    expect(home).toContain("经营管理");
    expect(home).toContain("BeautyHomeOverviewCard");
    expect(home).toContain("BeautyAppointmentReminders");
    expect(home).toContain("BeautyBusinessEntryGrid");
    expect(overview).toContain("本月完成");
    expect(overview).toContain("本月成交");
    expect(overview).toContain("待执行");
    expect(overview).toContain('value: unavailable ? "—"');
    expect(reminders).toContain("近期预约");
    expect(reminders).toContain("查看全部");
    expect(reminders).toMatch(/\.reminders__all\s*\{[^}]*min-height:\s*88rpx/s);
    expect(entries).toContain("预约执行");
    expect(entries).toContain("顾客管理");
    expect(entries).toContain("服务项目");
    expect(entries).toContain("物品库存");

    for (const source of [home, overview, reminders, entries]) {
      expect(source).not.toContain("<image");
      expect(source).not.toContain("data:image/");
    }
  });

  it("业务入口和模块导航只调用语义化本地图标", () => {
    const entries = readSource("./components/BeautyBusinessEntryGrid.vue");
    const navigation = readSource("./components/BeautyModuleNavigation.vue");
    const glyphMap = readSource("../shared/icon-font.generated.ts");

    for (const name of [
      "appointment",
      "customer",
      "projects",
      "inventory",
      "calendar",
      "reports",
      "data",
    ]) {
      expect(glyphMap).toContain(`"${name}":`);
    }
    expect(entries).toContain('icon: "appointment"');
    expect(entries).toContain('icon: "customer"');
    expect(entries).toContain('icon: "projects"');
    expect(entries).toContain('icon: "inventory"');
    expect(navigation).toContain('icon: "home"');
    expect(navigation).toContain('icon: "calendar"');
    expect(navigation).toContain('icon: "reports"');
    expect(navigation).toContain('icon: "data"');
    expect(navigation).not.toContain("glyph");
  });

  it("四个业务入口以独立按钮、右箭头和按压态表达可点击性", () => {
    const entries = readSource("./components/BeautyBusinessEntryGrid.vue");

    expect(entries).toContain('hover-class="business-entry--pressed"');
    expect(entries).toContain('<AppIcon name="chevron-right"');
    expect(entries).toMatch(
      /\.business-entries__grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s,
    );
    expect(entries).toMatch(
      /\.business-entry\s*\{[^}]*(?:border:[^;]+;)[^}]*background:\s*#ffffff;/s,
    );
    expect(entries).toMatch(/\.business-entry--pressed\s*\{/);
  });

  it("列表保持实体面板，毛玻璃只用于概览和固定导航", () => {
    const overview = readSource("./components/BeautyHomeOverview.vue");
    const reminders = readSource("./components/BeautyAppointmentReminders.vue");
    const entries = readSource("./components/BeautyBusinessEntryGrid.vue");
    const navigation = readSource("./components/BeautyModuleNavigation.vue");

    expect(overview).toContain("backdrop-filter: blur");
    expect(navigation).toMatch(
      /\.module-navigation__item--active\s*\{[^}]*backdrop-filter:\s*blur/s,
    );
    expect(reminders).not.toContain("backdrop-filter");
    expect(entries).not.toContain("backdrop-filter");
    expect(reminders).toContain("background: #ffffff");
    expect(entries).toContain("background: #fffdfd");
  });
});
