import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readComponent(fileName: string): string {
  return readFileSync(new URL(fileName, import.meta.url), "utf8");
}

describe("restore confirmation component event", () => {
  it("uses one lowercase event name across every WeChat component boundary", () => {
    const section = readComponent("./BackupRestoreSection.vue");
    const panel = readComponent("./BackupRestorePanel.vue");
    const beautyPage = readComponent("../../../pages/beauty/index.vue");
    const systemPage = readComponent("../../../pages/backup-restore/index.vue");

    expect(section).toContain('(event: "proceed"): void;');
    expect(section).toContain('@click="emit(\'proceed\')"');
    expect(panel).toContain('(event: "proceed"): void;');
    expect(panel).toContain('@proceed="emit(\'proceed\')"');
    expect(beautyPage).toContain('@proceed="requestBeautyRestoreConfirmation"');
    expect(systemPage).toContain('@proceed="requestRestoreConfirmation"');
    expect(section).not.toContain('request-restore');
    expect(panel).not.toContain('confirm-restore');
    expect(beautyPage).not.toContain('@confirm-restore');
    expect(systemPage).not.toContain('@confirm-restore');
    expect(beautyPage).toContain("resetRestore,");
    expect(beautyPage).toContain('resetRestore();\n  selectTab("home");');
  });
});
