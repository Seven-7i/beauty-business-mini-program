import { describe, expect, it, vi } from "vitest";
import {
  acknowledgeQuickAddedInventoryItem,
  beginQuickAddInventoryRequest,
  cancelQuickAddInventoryRequest,
  completeInventoryCreateNavigation,
  peekQuickAddedInventoryItem,
  prepareLegacyInventoryQuickAddRedirect,
  resolveInventoryCreateQuickAddMode,
  type InventoryCreateNavigationRuntime,
} from "@/features/beauty-project/quick-add-inventory-handoff";

/** 创建可断言返回方式的库存新增导航运行时。 */
function createRuntime(pageCount: number): {
  runtime: InventoryCreateNavigationRuntime;
  showSavedToast: ReturnType<typeof vi.fn>;
  navigateBack: ReturnType<typeof vi.fn>;
  relaunchInventory: ReturnType<typeof vi.fn>;
} {
  const showSavedToast = vi.fn();
  const navigateBack = vi.fn();
  const relaunchInventory = vi.fn();
  return {
    runtime: {
      getPageCount: () => pageCount,
      showSavedToast,
      navigateBack,
      relaunchInventory,
    },
    showSavedToast,
    navigateBack,
    relaunchInventory,
  };
}

describe("库存物品独立新增导航", () => {
  it("只接受仍有来源页面的一次性项目快速新增请求", () => {
    const requestId = beginQuickAddInventoryRequest();

    expect(
      resolveInventoryCreateQuickAddMode(
        { mode: "project-quick-add", requestId },
        2,
      ),
    ).toBe(true);
    expect(
      resolveInventoryCreateQuickAddMode(
        { mode: "project-quick-add", requestId },
        2,
      ),
    ).toBe(false);

    const rootRequestId = beginQuickAddInventoryRequest();
    expect(
      resolveInventoryCreateQuickAddMode(
        { mode: "project-quick-add", requestId: rootRequestId },
        1,
      ),
    ).toBe(false);
  });

  it("导航失败后撤销来源请求，未知请求也按普通新增处理", () => {
    const requestId = beginQuickAddInventoryRequest();
    cancelQuickAddInventoryRequest(requestId);

    expect(
      resolveInventoryCreateQuickAddMode(
        { mode: "project-quick-add", requestId },
        2,
      ),
    ).toBe(false);
    expect(
      resolveInventoryCreateQuickAddMode(
        { mode: "project-quick-add", requestId: "forged" },
        2,
      ),
    ).toBe(false);
  });

  it("旧快速新增入口为项目来源补发一次性标识，根入口降级为普通新增", () => {
    const projectRedirect = prepareLegacyInventoryQuickAddRedirect(2);
    expect(projectRedirect.requestId).toBeTruthy();
    expect(
      resolveInventoryCreateQuickAddMode(
        {
          mode: "project-quick-add",
          requestId: projectRedirect.requestId,
        },
        2,
      ),
    ).toBe(true);

    const rootRedirect = prepareLegacyInventoryQuickAddRedirect(1);
    expect(rootRedirect).toEqual({ url: "/pages/inventory-create/index" });
    expect(
      resolveInventoryCreateQuickAddMode(
        { mode: "project-quick-add" },
        1,
      ),
    ).toBe(false);
  });

  it("普通新增返回来源但不写入项目回传槽", () => {
    const navigation = createRuntime(2);

    completeInventoryCreateNavigation("inventory-normal", false, navigation.runtime);

    expect(navigation.showSavedToast).toHaveBeenCalledOnce();
    expect(navigation.navigateBack).toHaveBeenCalledOnce();
    expect(navigation.relaunchInventory).not.toHaveBeenCalled();
    expect(peekQuickAddedInventoryItem()).toBeUndefined();
  });

  it("有效快速新增回传新物品，深链普通新增回到库存列表", () => {
    const quickAddNavigation = createRuntime(2);
    completeInventoryCreateNavigation(
      "inventory-quick",
      true,
      quickAddNavigation.runtime,
    );

    expect(peekQuickAddedInventoryItem()).toBe("inventory-quick");
    expect(quickAddNavigation.navigateBack).toHaveBeenCalledOnce();
    acknowledgeQuickAddedInventoryItem("inventory-quick");

    const rootNavigation = createRuntime(1);
    completeInventoryCreateNavigation(
      "inventory-root",
      false,
      rootNavigation.runtime,
    );
    expect(rootNavigation.navigateBack).not.toHaveBeenCalled();
    expect(rootNavigation.relaunchInventory).toHaveBeenCalledOnce();
    expect(peekQuickAddedInventoryItem()).toBeUndefined();
  });
});
