import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("美容数据页定稿契约", () => {
  it("在模块内数据页提供导出、恢复和未加密风险提示", () => {
    const panel = readSource("./components/BeautyDataPanel.vue");
    const beautyPage = readSource("../../pages/beauty/index.vue");

    expect(panel).toContain("最近导出");
    expect(panel).toContain("导出美容模块");
    expect(panel).toContain("从备份恢复");
    expect(panel).toContain("备份文件未加密，请妥善保管");
    expect(panel).toContain("BackupExportSection");
    expect(panel).toContain("BackupRestoreSection");
    expect(panel).toContain('name="backup"');
    expect(panel).toContain('name="file-restore"');
    expect(panel).toMatch(/\.export-status-card\s*\{[^}]*backdrop-filter:\s*blur/s);
    expect(panel).toMatch(/\.data-action\s*\{[^}]*background:\s*#fffdfd;/s);
    expect(panel).toMatch(/\.data-action--active\s*\{[^}]*linear-gradient/s);
    expect(panel).toContain("data-action__details");
    expect(panel).not.toContain("数据安心放在手边");
    expect(panel).not.toContain("庄月空间 · 美容");
    expect(beautyPage).toContain("BeautyDataPanel");
    expect(beautyPage).not.toContain('context="beauty"');
  });

  it("支持同一入口再次点击收起并同步箭头与容器层级", () => {
    const panel = readSource("./components/BeautyDataPanel.vue");

    expect(panel).toContain(
      "activeAction.value = activeAction.value === action ? undefined : action;",
    );
    expect(panel).toContain("data-action__chevron");
    expect(panel).toContain("data-action__chevron--expanded");
    expect(panel).toMatch(
      /\.data-action--active\s*\{[^}]*border-radius:\s*25rpx 25rpx 0 0;/s,
    );
    expect(panel).toMatch(
      /\.data-action__chevron--expanded\s*\{[^}]*transform:\s*rotate\(-90deg\);/s,
    );
  });
});
