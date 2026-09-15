import { describe, expect, it } from "vitest";
import indexPageSource from "@/pages/index/index.vue?raw";

describe("单模块启动路由契约", () => {
  it("首次初始化与数据保护重试共用自动进入模块的编排入口", () => {
    expect(indexPageSource).toContain("const initialModule = await initialize()");
    expect(indexPageSource).toContain("await openModule(initialModule)");
    expect(indexPageSource).toContain('@retry="initializePage"');
  });

  it("模块跳转保留工作台返回层，并在失败时给出可恢复提示", () => {
    expect(indexPageSource).toContain("uni.navigateTo({");
    expect(indexPageSource).toContain('beauty: "/pages/beauty/index"');
    expect(indexPageSource).toContain("模块打开失败，请稍后重试");
  });
});
