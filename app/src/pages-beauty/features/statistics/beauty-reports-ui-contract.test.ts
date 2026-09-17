import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("美容报表定稿视觉契约", () => {
  it("按月份、四项汇总和服务贡献组合页面", () => {
    const reports = readSource("./components/BeautyReports.vue");
    const summary = readSource("./components/BeautyReportSummary.vue");
    const contribution = readSource("./components/BeautyServiceContribution.vue");

    expect(reports).toContain("BeautyReportSummary");
    expect(reports).toContain("BeautyServiceContribution");
    expect(summary).toContain("2026年9月");
    expect(summary).toContain("@tap=\"emit('previousMonth')\"");
    expect(summary).toContain("@tap=\"selectNextMonth\"");
    expect(summary).toContain("report-month__arrow--disabled");
    expect(summary).toContain("report-month__chevron--previous");
    expect(summary).toContain("report-month__chevron--next");
    expect(summary).not.toContain("<AppIcon");
    expect(summary).not.toContain("transform: rotate(180deg)");
    expect(reports).toContain("@previous-month");
    expect(reports).toContain("@next-month");
    expect(summary).toContain("较上月");
    expect(summary).toContain('return change > 0 ? "up" : "down"');
    expect(summary).toContain("report-summary__value--up { color: #d85d66; }");
    expect(summary).toContain("report-summary__value--down { color: #55a66a; }");
    expect(summary).toContain("report-summary__value--neutral { color: #756d7d; }");
    expect(summary).toContain("grid-template-columns: repeat(4");
    expect(contribution).toContain("service-contribution__rank");
    expect(contribution).toContain("service-contribution__icon");
    expect(contribution).toContain("本月完成服务后，这里会显示服务贡献。");
    expect(contribution).not.toContain("service-contribution__empty-icon");
    expect(contribution).not.toContain("本月暂无服务贡献");
    expect(contribution).not.toContain("成交趋势");
  });

  it("使用定稿的间距、圆角和字号层级", () => {
    const summary = readSource("./components/BeautyReportSummary.vue");
    const contribution = readSource("./components/BeautyServiceContribution.vue");

    expect(summary).toMatch(/\.report-month\s*\{[^}]*width:\s*268rpx[^}]*height:\s*60rpx/s);
    expect(summary).toMatch(/\.report-month__label\s*\{[^}]*white-space:\s*nowrap/s);
    expect(summary).toContain("grid-template-columns: 52rpx minmax(0, 1fr) 52rpx");
    expect(summary).toMatch(/\.report-month__label\s*\{[^}]*align-self:\s*center[^}]*line-height:\s*30rpx/s);
    expect(summary).toMatch(/\.report-month__arrow\s*\{[^}]*align-self:\s*center/s);
    expect(summary).toMatch(/\.report-month__chevron\s*\{[^}]*width:\s*12rpx[^}]*height:\s*12rpx/s);
    expect(summary).toContain("#eee5fb");
    expect(summary).toContain("#ece3f9");
    expect(summary).toMatch(/\.report-summary\s*\{[^}]*min-height:\s*178rpx[^}]*border-radius:\s*28rpx/s);
    expect(summary).toMatch(/\.report-summary__value\s*\{[^}]*font-size:\s*42rpx/s);
    expect(contribution).toMatch(/\.service-contribution__title\s*\{[^}]*font-size:\s*34rpx/s);
    expect(contribution).toMatch(/\.service-contribution__icon\s*\{[^}]*width:\s*72rpx[^}]*height:\s*72rpx/s);
  });
});
