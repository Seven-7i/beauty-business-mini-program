import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { ApplicationData } from "@/domain/data-schema";
import { useInventoryManagement } from "@/features/inventory/composables/useInventoryManagement";
import type { InventoryManagementService } from "@/services/inventory-management-service";

function readSource(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const emptyData: ApplicationData = {
  schemaVersion: 1,
  settings: { schemaVersion: 1 },
  unlockedModules: ["beauty"],
  backupMetadata: { schemaVersion: 1 },
  inventoryItems: [],
  inventoryMovements: [],
  projects: [],
  customers: [],
  appointments: [],
};

describe("阶段 4 界面韧性契约", () => {
  it("区分可重试的读取失败与不可盲目重试的业务操作失败", async () => {
    const service = {
      readData: vi.fn().mockRejectedValueOnce(new Error("read failed")),
      createInventoryItem: vi.fn().mockRejectedValueOnce(new Error("名称重复")),
    } as unknown as InventoryManagementService;
    const management = useInventoryManagement({ service });

    await management.refresh();
    expect(management.errorKind.value).toBe("read");

    await management.createItem({
      name: "精华液",
      unit: "瓶",
      unitKind: "discrete",
      initialQuantityInput: "1",
    });
    expect(management.errorKind.value).toBe("operation");
    expect(management.errorMessage.value).toBe("名称重复");
  });

  it("核心数据容器把读取重试交给统一错误组件", () => {
    const containers = [
      "./inventory/components/InventoryManagement.vue",
      "./beauty-project/components/BeautyProjectManagement.vue",
      "./customer/components/CustomerManagement.vue",
      "./appointment/components/AppointmentManagement.vue",
      "./history-cleanup/components/HistoryCleanup.vue",
    ];

    for (const path of containers) {
      const source = readSource(path);
      expect(source).toContain("RecoverableErrorNotice");
      expect(source).toContain(":retryable=\"errorKind === 'read'\"");
      expect(source).toContain('@retry="refresh"');
    }
  });

  it("高风险动态卡片允许长文本换行且操作按钮保持最小触控高度", () => {
    const inventory = readSource("./inventory/components/InventoryItemList.vue");
    const projects = readSource("./beauty-project/components/BeautyProjectList.vue");
    const customers = readSource("./customer/components/CustomerList.vue");
    const appointments = readSource("./appointment/components/AppointmentList.vue");

    for (const source of [inventory, projects, customers, appointments]) {
      expect(source).toContain("overflow-wrap: anywhere");
      expect(source).toMatch(/min-height:\s*68rpx/);
      expect(source).toContain("flex-wrap: wrap");
    }
    expect(inventory).not.toContain(".item-card__name {\n  overflow: hidden");
  });

  it("语义图标使用本地精简字体且图标底座不产生文本行盒偏移", () => {
    const icon = readSource("./shared/components/AppIcon.vue");
    const glyphMap = readSource("./shared/icon-font.generated.ts");
    const font = readFileSync(
      new URL("../static/fonts/zhuangyue-icons.ttf", import.meta.url),
    );
    const myMenu = readSource("./my-center/components/MyCenterMenu.vue");

    expect(icon).toContain('font-family: "ZhuangYueIcons"');
    expect(icon).toContain("zhuangyue-icons.ttf");
    expect(icon).toContain("{{ glyph }}");
    expect(glyphMap).toContain('"history": "\\uE005"');
    expect(font.subarray(0, 4).toString("hex")).toBe("00010000");
    expect(font.byteLength).toBeLessThan(40 * 1024);
    expect(icon).not.toContain("<svg");
    expect(icon).not.toContain("https://");
    expect(icon).toMatch(/\.app-icon\s*\{[^}]*display:\s*inline-flex;[^}]*line-height:\s*0;/s);
    expect(myMenu).toMatch(/\.my-menu__icon\s*\{[^}]*line-height:\s*0;/s);
  });

  it("文件恢复图标使用清晰的文件内向下箭头，不叠加拥挤的回转圆弧", () => {
    const generator = readSource("../../scripts/generate-icon-font.mjs");
    const restoreGlyph = generator.match(
      /function createFileRestore\(\) \{([\s\S]*?)\n\}/,
    )?.[1];

    expect(restoreGlyph).toBeDefined();
    expect(restoreGlyph).not.toContain("addArc");
    expect(restoreGlyph).toContain("[500, 520]");
    expect(restoreGlyph).toContain("[500, 250]");
  });

  it("全局页面图标沿用定稿轮廓且不叠加偏离图稿的装饰底座", () => {
    const icon = readSource("./shared/components/AppIcon.vue");
    const overview = readSource(
      "./backup-restore/components/BackupExportOverview.vue",
    );
    const myMenu = readSource("./my-center/components/MyCenterMenu.vue");
    const storage = readSource(
      "./storage-capacity/components/StorageCapacityCard.vue",
    );
    const scopeActions = readSource(
      "./backup-restore/components/BackupScopeActions.vue",
    );
    const restoreSection = readSource(
      "./backup-restore/components/SystemBackupRestoreSection.vue",
    );
    const exportSection = readSource(
      "./backup-restore/components/SystemBackupExportSection.vue",
    );
    const restoreCandidate = readSource(
      "./backup-restore/components/BackupRestoreCandidate.vue",
    );

    const glyphMap = readSource("./shared/icon-font.generated.ts");
    for (const name of [
      "home",
      "account",
      "storage",
      "backup",
      "history",
      "file-restore",
      "shield",
      "modules",
      "info",
      "chevron-right",
    ]) {
      expect(glyphMap).toContain(`"${name}":`);
    }
    expect(icon).not.toContain("app-icon__history-tail");
    expect(icon).not.toContain("app-icon__history-orbit");
    expect(icon).not.toContain("app-icon__history-arrow");
    expect(icon).not.toContain("border-right: 2rpx dashed");
    expect(icon).not.toContain("border-left-color: transparent");
    expect(icon).not.toContain("app-icon__history-face");
    expect(overview).toContain('<AppIcon name="history" :size="60"');
    expect(overview).not.toContain("export-overview__ring");

    expect(myMenu).not.toMatch(
      /\.my-menu__icon\s*\{[^}]*(?:border|background|box-shadow):/s,
    );
    expect(scopeActions).not.toMatch(
      /\.scope-actions__icon\s*\{[^}]*(?:border|background|box-shadow):/s,
    );
    expect(restoreSection).not.toMatch(
      /\.system-restore__icon\s*\{[^}]*(?:border|background|box-shadow):/s,
    );
    expect(exportSection).not.toMatch(
      /\.system-export__icon\s*\{[^}]*(?:border|background|box-shadow):/s,
    );
    expect(restoreCandidate).not.toMatch(
      /\.restore-candidate__icon\s*\{[^}]*(?:border|background|box-shadow):/s,
    );
    expect(storage).not.toContain('<AppIcon name="storage"');
    expect(storage).not.toContain("storage-card__icon");
  });

  it("系统备份恢复页沿用暖石磨砂层次且不把视觉稿图片带入运行时", () => {
    const panel = readSource("./backup-restore/components/BackupRestorePanel.vue");
    const overview = readSource("./backup-restore/components/BackupExportOverview.vue");
    const exportSection = readSource(
      "./backup-restore/components/SystemBackupExportSection.vue",
    );
    const restoreSection = readSource(
      "./backup-restore/components/SystemBackupRestoreSection.vue",
    );
    const scopeActions = readSource(
      "./backup-restore/components/BackupScopeActions.vue",
    );
    const sources = [panel, overview, exportSection, restoreSection, scopeActions];

    expect(panel).toContain("守住本机数据");
    expect(panel).toContain("备份文件未加密");
    expect(panel).toMatch(/\.system-panel\s*\{[^}]*background:\s*#f3f1ec;/s);
    expect(overview).toContain("最近完整系统导出");
    expect(exportSection).toContain("导出备份");
    expect(scopeActions).toContain("完整系统备份");
    expect(scopeActions).toContain("选择模块导出");
    expect(scopeActions).not.toContain("立即导出");
    expect(restoreSection).toContain("从备份文件恢复");
    expect(sources.some((source) => source.includes("backdrop-filter: blur"))).toBe(true);

    for (const source of sources) {
      expect(source).not.toContain("<image");
      expect(source).not.toContain("data:image/");
    }
  });

  it("模块管理作为独立系统子页实现定稿且不显示全局底部导航", () => {
    const pages = readSource("../pages.json");
    const index = readSource("../pages/index/index.vue");
    const page = readSource("../pages/module-management/index.vue");
    const management = readSource("./my-center/components/ModuleManagement.vue");
    const modules = readSource("./my-center/components/UnlockedModulesCard.vue");
    const authorization = readSource(
      "./my-center/components/ModuleAuthorizationForm.vue",
    );
    const codeInput = readSource("./shared/components/ModuleCodeInput.vue");

    expect(pages).toContain('"path": "pages/module-management/index"');
    expect(index).toContain('uni.navigateTo({ url: "/pages/module-management/index" })');
    expect(index).not.toContain("managingModules");
    expect(page).toContain("onShow(refresh)");
    expect(page).not.toContain("AppBottomNavigation");
    expect(management).toContain("管理业务模块");
    expect(management).toContain("模块仅在当前设备开启");
    expect(management).toContain("已解锁模块");
    expect(management).toContain('v-if="!props.readError || props.hasLoaded"');
    expect(management).toMatch(/\.module-management\s*\{[^}]*background:\s*#f3f1ec;/s);
    expect(modules).toContain("顾客 · 项目 · 预约");
    expect(modules).toContain("已解锁");
    expect(authorization).toContain("输入 6 位模块授权码");
    expect(authorization).toContain("第一版只允许增加模块，不提供移除入口");
    expect(authorization).toContain(':maxlength="6"');
    expect(codeInput).toMatch(/\.module-code-input\s*\{[^}]*display:\s*flex;/s);
    expect(codeInput).toMatch(/\.module-code-input\s*\{[^}]*width:\s*550rpx;/s);
    expect(codeInput).toMatch(/\.module-code-input__cell\s*\{[^}]*flex:\s*1;/s);
    expect(codeInput).not.toContain("grid-template-columns");

    for (const source of [page, management, modules, authorization, codeInput]) {
      expect(source).not.toContain("<image");
      expect(source).not.toContain("data:image/");
    }
  });

  it("未确认导出由全局启动门禁优先处理，分享页返回后立即强确认", () => {
    const app = readSource("../App.vue");
    const index = readSource("../pages/index/index.vue");
    const systemBackup = readSource("../pages/backup-restore/index.vue");
    const beauty = readSource("../pages/beauty/index.vue");

    expect(app).toContain("上次导出尚未确认");
    expect(app).toContain("setStartupExportConfirmationGate");
    expect(app).toContain("instanceof PendingExportSentDecisionCommittedError");
    expect(app).toContain('result === "sent-committed"');
    expect(index).toContain("waitForStartupExportConfirmation");
    expect(index).toMatch(
      /await waitForStartupExportConfirmation\(\);[\s\S]*handledPending[\s\S]*return;[\s\S]*checkStorageCapacity\(\)/,
    );
    for (const source of [systemBackup, beauty]) {
      expect(source).toContain("备份文件是否已发送？");
      expect(source).toContain("shareAndConfirmExport");
    }
  });
});
