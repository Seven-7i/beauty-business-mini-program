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
      "./customer/components/CustomerDetailPage.vue",
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
    const customers = readSource("./customer/components/CustomerCard.vue");
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
      "search",
      "add",
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

  it("顾客管理与独立详情页实现已确认的列表和双 Tab 分层", () => {
    const pages = readSource("../pages.json");
    const management = readSource(
      "./customer/components/CustomerManagement.vue",
    );
    const list = readSource("./customer/components/CustomerList.vue");
    const card = readSource("./customer/components/CustomerCard.vue");
    const detail = readSource("./customer/components/CustomerDetail.vue");
    const detailPage = readSource(
      "./customer/components/CustomerDetailPage.vue",
    );
    const detailProfile = readSource(
      "./customer/components/CustomerDetailProfile.vue",
    );
    const detailTabs = readSource(
      "./customer/components/CustomerDetailTabs.vue",
    );
    const profileDetails = readSource(
      "./customer/components/CustomerProfileDetails.vue",
    );
    const form = readSource("./customer/components/CustomerForm.vue");
    const editor = readSource("./customer/components/CustomerEditor.vue");
    const draftProtection = readSource(
      "./customer/composables/useCustomerDraftProtection.ts",
    );
    const customerPage = readSource("../pages/customer/index.vue");
    const customerCreatePage = readSource("../pages/customer-create/index.vue");
    const customerDetailRoute = readSource(
      "../pages/customer-detail/index.vue",
    );
    const detailNavigation = readSource(
      "./customer/customer-detail-navigation.ts",
    );
    const editorNavigation = readSource(
      "./customer/customer-create-navigation.ts",
    );
    const customerState = readSource(
      "./customer/composables/useCustomerManagement.ts",
    );

    expect(pages).toContain('"navigationBarTitleText": "顾客管理"');
    expect(pages).toContain('"navigationBarBackgroundColor": "#FFF8FA"');
    expect(pages).toContain('"path": "pages/customer-create/index"');
    expect(pages).toContain('"navigationBarTitleText": "新增顾客"');
    expect(pages).toContain('"path": "pages/customer-detail/index"');
    expect(pages).toContain('"navigationBarTitleText": "顾客详情"');
    expect(management).not.toContain("customer-management__intro");
    expect(management).not.toContain("screen ===");
    expect(management).not.toContain("<CustomerDetail");
    expect(management).not.toContain("<CustomerForm");
    expect(management).toContain('@add="openCreateCustomer"');
    expect(management).toContain("openCustomerEditor();");
    expect(management).toContain("openCustomerDetail(customer.id)");
    expect(detailNavigation).toContain(
      "/pages/customer-detail/index?customerId=",
    );
    expect(customerPage).toContain("onShow(refreshCustomerManagement)");
    expect(customerPage).toContain('ref="customerManagement"');
    expect(customerCreatePage).toContain("<CustomerEditor");
    expect(customerCreatePage).toContain("readCustomerEditorId(query)");
    expect(customerCreatePage).toContain('title: customerId.value ? "编辑顾客" : "新增顾客"');
    expect(customerDetailRoute).toContain("readCustomerDetailId(query)");
    expect(customerDetailRoute).toContain("<CustomerDetailPage");
    expect(customerDetailRoute).toContain("onShow(refreshCustomerDetail)");
    expect(customerDetailRoute).toContain('@edit="openCustomerEditor(customerId)"');
    expect(customerDetailRoute).toContain("returnToCustomerList()");
    expect(customerDetailRoute).toContain("返回顾客列表");
    expect(detailPage).toContain("RecoverableErrorNotice");
    expect(detailPage).toContain(":retryable=\"errorKind === 'read'\"");
    expect(detailPage).not.toContain('@dirty-change="updateDirty"');
    expect(detailPage).toContain("scrollToErrorNotice");
    expect(detailPage).toContain("return refreshCustomer();");
    expect(detailPage).toContain(`@edit="emit('edit')"`);
    expect(detailPage).toContain("返回顾客列表");
    expect(customerState).not.toContain('screen === "detail"');
    expect(customerState).not.toContain("refreshCustomerDetailForScreen");
    expect(detailPage).not.toContain("../customer-detail-state");
    expect(detail).not.toContain("../customer-detail-tabs");
    expect(editor).toContain("<CustomerForm");
    expect(editor).toContain(":editing-customer=\"customer\"");
    expect(editor).toContain("completeCustomerEditorNavigation(props.customerId)");
    expect(editor).toContain("createCustomerEditorCompletionGuard");
    expect(editor).toContain("notifyCustomerSaved(props.customerId)");
    expect(editor).toContain("if (submitting.value)");
    expect(editor).toContain("updateSaving(true)");
    expect(editor).toContain("if (!completionGuard.isActive())");
    expect(editor).toContain('@dirty-change="updateDirty"');
    expect(editorNavigation).toContain("buildCustomerEditorUrl");
    expect(editorNavigation).toContain("buildCustomerDetailUrl(customerId)");
    expect(customerState).toContain("export function useCustomerEditor");
    expect(editor).toContain(
      'from "../composables/useCustomerManagement"',
    );
    expect(draftProtection).toContain("顾客资料正在保存，离开后仍会完成保存。");
    expect(draftProtection).toContain(
      "runtime.wechat.enableAlertBeforeUnload",
    );
    expect(customerPage).toContain("subscribeCustomerSaved");
    expect(customerDetailRoute).toContain("subscribeCustomerSaved");
    expect(list).toContain('<AppIcon name="search"');
    expect(list).toContain('<AppIcon name="add"');
    expect(list).toContain("搜索昵称或手机号");
    expect(list).toContain("仅看停用");
    expect(list).not.toContain("customer-list__filters");
    expect(list).not.toContain('@edit="');
    expect(list).not.toContain('@delete="');
    expect(card).not.toContain("customer-card__status");
    expect(card).toContain("customer-card__name--inactive");
    expect(card).toContain("text-decoration: line-through");
    expect(detail).toContain("<CustomerDetailProfile");
    expect(detail).toContain("<CustomerDetailTabs");
    expect(detail).toContain("<CustomerProfileDetails");
    expect(detail).toContain("<CustomerAppointmentHistory");
    expect(detailProfile).toContain("累计完成");
    expect(detailProfile).toContain("累计成交");
    expect(detailProfile).toContain("call: [phoneNumber: string]");
    expect(detailProfile).toContain(
      `@click="emit('call', customer.phone)"`,
    );
    expect(detailProfile).toMatch(/<u-icon\s+[^>]*name="phone"/s);
    expect(detailProfile).not.toContain('<AppIcon name="phone"');
    expect(detailProfile).toContain(
      '<text class="customer-profile__phone-action">拨打</text>',
    );
    expect(detailProfile).toMatch(
      /\.customer-profile__phone\s*\{[^}]*border-radius:\s*12rpx;[^}]*background:\s*#f2edfa;/s,
    );
    expect(detailProfile).not.toContain("text-decoration: underline");
    expect(detail).toContain('@call="callCustomer"');
    expect(detail).toContain("uni.makePhoneCall({");
    expect(detail).toContain("phoneNumber,");
    expect(detail).toContain('title: "未能打开拨号界面"');
    expect(detailProfile).toMatch(
      /\.customer-profile__edit\s*\{[^}]*display:\s*flex;[^}]*height:\s*68rpx;[^}]*align-items:\s*center;[^}]*padding:\s*0 20rpx;[^}]*line-height:\s*1;/s,
    );
    expect(detailTabs).toContain("顾客资料");
    expect(detailTabs).toContain("历史预约 {{ appointmentCount }}");
    expect(profileDetails).toContain("服务地址");
    expect(profileDetails).toContain("资料操作");
    expect(profileDetails).toContain("停用顾客");
    expect(profileDetails).toContain("重新启用");
    expect(profileDetails).toContain("彻底删除");
    expect(detailTabs).toContain('class="customer-tabs__indicator"');
    expect(detailTabs).toMatch(
      /\.customer-tabs__indicator\s*\{[^}]*position:\s*absolute;[^}]*bottom:\s*-2rpx;/s,
    );
    expect(detailTabs).not.toContain(
      ".customer-tabs__item--active::after",
    );
    expect(form).toContain("customer-form__field-error");
    expect(form).toContain("getCustomerFormErrorField");
    expect(form).toContain('code === "empty-address"');
    expect(form).toContain('".address-card--invalid"');
    expect(form).toContain("customer-form--page");
    expect(form).toContain("请输入中国大陆 11 位手机号");
    expect(form).toContain("保存顾客");
    expect(form.match(/:disabled="submitting"/g)).toHaveLength(7);
    expect(form).toContain("if (props.submitting)");
    expect(form).toContain("form.addresses.unshift");
    expect(form).toContain("shouldConfirmCustomerAddressRemoval");
    expect(form).toContain('title: "移除服务地址"');
    expect(form).toMatch(
      /\.customer-form--page \.address-editor__empty\s*\{[^}]*padding:\s*22rpx 0;[^}]*text-align:\s*center;/s,
    );
  });

  it("系统备份恢复页沿用暖石磨砂层次", () => {
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

  });

  it("模块管理作为独立系统子页实现定稿且不显示全局底部导航", () => {
    const viteConfig = readSource("../../vite.config.ts");
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
    expect(codeInput).toContain("<up-code-input");
    expect(codeInput).toContain(':disabled-keyboard="props.disabled"');
    expect(codeInput).toContain(':hairline="false"');
    expect(codeInput).toContain('size="74rpx"');
    expect(codeInput).toMatch(/\.module-code-input\s*\{[^}]*height:\s*80rpx/s);
    expect(codeInput).not.toContain('class="module-code-input__native"');
    expect(viteConfig).toContain('process.env.UNI_PLATFORM === "mp-weixin"');
    expect(viteConfig).toContain('minify: isWeixinMiniProgram ? false : "esbuild"');

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
