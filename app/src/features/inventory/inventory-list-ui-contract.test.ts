import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** 读取与当前测试文件相对的 Vue 或路由源文件。 */
function readSource(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("库存物品列表定稿契约", () => {
  it("使用独立原生标题、名称搜索、新增和停用范围控制", () => {
    const pages = readSource("../../pages.json");
    const list = readSource("./components/InventoryItemList.vue");

    expect(pages).toMatch(
      /"path": "pages\/inventory\/index"[\s\S]*?"navigationBarTitleText": "库存物品"/,
    );
    expect(pages).toMatch(
      /"path": "pages\/inventory\/index"[\s\S]*?"navigationBarBackgroundColor": "#FFF8FA"/,
    );
    expect(pages).toMatch(
      /"path": "pages\/inventory-detail\/index"[\s\S]*?"navigationBarTitleText": "物品详情"/,
    );
    expect(pages).toContain('"path": "pages/inventory-adjustment/index"');
    expect(pages).toContain('"path": "pages/inventory-profile-edit/index"');
    expect(pages).toMatch(
      /"path": "pages\/inventory-create\/index"[\s\S]*?"navigationBarTitleText": "新增库存物品"/,
    );
    expect(list).toContain("搜索物品名称");
    expect(list).toContain("新增库存物品");
    expect(list).toContain("仅看停用");
    expect(list).not.toContain("全部状态");
    expect(list).toContain('name="search"');
    expect(list).toContain('name="plus"');
  });

  it("卡片展示三项库存数据并保留两个明确的调整入口", () => {
    const card = readSource("./components/InventoryItemCard.vue");

    expect(card).toContain("当前库存");
    expect(card).toContain("占用");
    expect(card).toContain("可用库存");
    expect(card).toContain("补货");
    expect(card).toContain("盘点修正");
    expect(card).toContain('name="download"');
    expect(card).toContain('name="edit-pen"');
    expect(card).toContain('name="arrow-right"');
    expect(card).not.toContain("单价");
    expect(card).not.toContain("成本");
  });

  it("使用实体卡片与美容模块色彩，不在页面增加底部导航", () => {
    const management = readSource("./components/InventoryManagement.vue");
    const card = readSource("./components/InventoryItemCard.vue");

    expect(management).toContain("#fff8fa");
    expect(management).not.toContain("AppBottomNavigation");
    expect(card).toContain("rgba(255, 255, 255, 0.96)");
    expect(card).toContain("#4c9f71");
    expect(card).not.toContain("backdrop-filter");
  });

  it("库存列表不再追加全局流水，卡片进入独立物品详情", () => {
    const management = readSource("./components/InventoryManagement.vue");

    expect(management).not.toContain("<InventoryMovementList");
    expect(management).toContain("/pages/inventory-detail/index?inventoryItemId=");
    expect(management).toContain('@view="openItemDetail"');
  });

  it("详情按当前物品展示概览、资料和库存动态", () => {
    const pages = readSource("../../pages.json");
    const detailPage = readSource("./components/InventoryItemDetailPage.vue");
    const detail = readSource("./components/InventoryItemDetail.vue");
    const timeline = readSource("./components/InventoryMovementList.vue");

    expect(pages).toContain('"path": "pages/inventory-detail/index"');
    expect(detailPage).toContain("filterInventoryMovementsForItem");
    expect(detail).toContain("库存动态");
    expect(detail).toContain("物品资料");
    expect(timeline).toContain("查看来源预约");
    expect(timeline).toContain("来源预约已删除");
    expect(timeline).not.toContain("props.items.find");
  });

  it("预约消耗从物品动态进入对应来源预约", () => {
    const detailPage = readSource("./components/InventoryItemDetailPage.vue");
    const appointmentPage = readSource("../../pages/appointment/index.vue");
    const appointmentManagement = readSource(
      "../appointment/components/AppointmentManagement.vue",
    );

    expect(detailPage).toContain(
      "/pages/appointment/index?appointmentId=",
    );
    expect(appointmentPage).toContain(":initial-appointment-id");
    expect(appointmentManagement).toContain("initialAppointmentId");
    expect(appointmentManagement).toContain('source?.status === "completed"');
  });

  it("新增使用独立页面，表单没有重复页头并锁定提交中的全部字段", () => {
    const management = readSource("./components/InventoryManagement.vue");
    const createPage = readSource("./components/InventoryItemCreatePage.vue");
    const createRoute = readSource("../../pages/inventory-create/index.vue");
    const createForm = readSource("./components/InventoryItemForm.vue");
    const adjustmentForm = readSource("./components/InventoryAdjustmentForm.vue");
    const profileForm = readSource("./components/InventoryItemProfileForm.vue");

    expect(management).toContain("/pages/inventory-create/index");
    expect(management).not.toContain("<InventoryItemForm");
    expect(management).toContain('v-show="!loading"');
    expect(management).toContain("inventory-management__list-view");
    expect(createPage).toContain("useInventoryFormLifecycle");
    expect(createPage).toContain("<InventoryItemForm");
    expect(createRoute).toContain("resolveInventoryCreateQuickAddMode");
    expect(createRoute).toContain("completeInventoryCreateNavigation");
    expect(createForm).not.toContain("item-form__heading");
    expect(createForm).not.toContain(">取消<");
    expect(createForm).toContain("首次库存会同时生成入库记录");
    expect(createForm).toContain("item-editor");
    expect(createForm).toMatch(
      /\.item-form__submit \{[\s\S]*?height: 88rpx;[\s\S]*?padding: 0;[\s\S]*?line-height: 1;/,
    );
    expect(createForm).toContain('role="button"');
    expect(createForm).toContain(':aria-disabled="submitting"');
    expect(createForm).toContain("item-form__submit--pressed");
    expect(createForm).not.toContain("<button class=\"item-form__submit\"");
    expect(createForm.match(/submitting/g)?.length).toBeGreaterThanOrEqual(8);
    expect(adjustmentForm.match(/:disabled="submitting"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(adjustmentForm.match(/:aria-disabled="submitting"/g)).toHaveLength(3);
    expect(profileForm).toMatch(
      /\.profile-form__submit \{[\s\S]*?height: 88rpx;[\s\S]*?padding: 0;[\s\S]*?line-height: 1;/,
    );
    expect(profileForm).toContain('role="button"');
    expect(profileForm).toContain(':aria-disabled="submitting"');
    expect(profileForm).toContain("profile-form__submit--pressed");
    expect(profileForm).not.toContain(
      "<button class=\"profile-form__submit\"",
    );
    expect(profileForm.match(/submitting/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("补货、盘点修正和资料编辑使用独立页面且不重复页头操作", () => {
    const management = readSource("./components/InventoryManagement.vue");
    const detailPage = readSource("./components/InventoryItemDetailPage.vue");
    const adjustmentPage = readSource("./components/InventoryAdjustmentPage.vue");
    const adjustmentForm = readSource("./components/InventoryAdjustmentForm.vue");
    const profilePage = readSource("./components/InventoryItemProfileEditPage.vue");
    const profileForm = readSource("./components/InventoryItemProfileForm.vue");

    expect(management).toContain("/pages/inventory-adjustment/index?");
    expect(detailPage).toContain("/pages/inventory-adjustment/index?");
    expect(detailPage).toContain("/pages/inventory-profile-edit/index?");
    expect(detailPage).not.toContain("<InventoryAdjustmentForm");
    expect(detailPage).not.toContain("<InventoryItemProfileForm");
    expect(adjustmentPage).toContain(":show-actions=\"false\"");
    expect(adjustmentForm).not.toContain("adjustment__header");
    expect(adjustmentForm).not.toContain(">取消<");
    expect(adjustmentForm).toContain("库存调整预览");
    expect(adjustmentForm).toContain('role="tablist"');
    expect(adjustmentForm.match(/role="tab"/g)).toHaveLength(2);
    expect(adjustmentForm).toContain("adjustment__switch-button--pressed");
    expect(adjustmentForm).not.toMatch(
      /<button[\s\S]*?adjustment__switch-button/,
    );
    expect(adjustmentForm).toMatch(
      /\.adjustment__submit \{[\s\S]*?height: 88rpx;[\s\S]*?padding: 0;[\s\S]*?line-height: 1;/,
    );
    expect(adjustmentForm).toContain("adjustment__submit--pressed");
    expect(adjustmentForm).not.toContain(
      "<button class=\"adjustment__submit\"",
    );
    expect(profilePage).toContain("unitLockedItemIds");
    expect(adjustmentPage).toContain("useInventoryFormLifecycle");
    expect(profilePage).toContain("useInventoryFormLifecycle");
    expect(adjustmentPage).toContain("emit('missing')");
    expect(profilePage).toContain("emit('missing')");
    expect(profileForm).not.toContain("profile-form__header");
    expect(profileForm).not.toContain("secondary-actions");
    expect(profileForm).not.toContain("停用物品");
    expect(profileForm).not.toContain("彻底删除");
  });
});
