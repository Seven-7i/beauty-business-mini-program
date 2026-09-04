import { onBeforeUnmount } from "vue";

/** 库存表单使用的微信原生返回询问最小接口。 */
export interface InventoryBeforeUnloadApi {
  /** 开启原生导航返回询问。 */
  enableAlertBeforeUnload(options: { message: string }): void;
  /** 关闭原生导航返回询问。 */
  disableAlertBeforeUnload(): void;
}

declare const wx: InventoryBeforeUnloadApi | undefined;

/** 可测试的库存表单草稿保护运行时依赖。 */
export interface InventoryDraftProtectionRuntime {
  /** 微信原生返回保护；非微信环境可以省略。 */
  wechat?: InventoryBeforeUnloadApi;
}

/**
 * 创建库存表单的原生返回保护控制器。
 * 当前由 `useInventoryFormLifecycle` 调用，测试可注入微信 API 替身验证状态边界。
 */
export function createInventoryDraftProtectionController(
  runtime: InventoryDraftProtectionRuntime,
) {
  let dirty = false;

  /** 同步草稿状态；有修改时询问是否放弃。 */
  function updateDirty(nextDirty: boolean): void {
    dirty = nextDirty;
    if (!runtime.wechat) {
      return;
    }
    if (nextDirty) {
      runtime.wechat.enableAlertBeforeUnload({ message: "放弃本次编辑？" });
      return;
    }
    runtime.wechat.disableAlertBeforeUnload();
  }

  /** 保存成功或组件卸载时解除返回保护。 */
  function resetDirty(): void {
    updateDirty(false);
  }

  /** 保存期间说明离开不会取消已开始的原子写入，失败后恢复原草稿保护。 */
  function updateSaving(saving: boolean): void {
    if (!runtime.wechat) {
      return;
    }
    if (saving) {
      runtime.wechat.enableAlertBeforeUnload({
        message: "库存数据正在保存，离开后仍会完成保存。",
      });
      return;
    }
    updateDirty(dirty);
  }

  return { updateDirty, resetDirty, updateSaving };
}

/**
 * 创建库存表单异步完成动作的生命周期门禁。
 * 当前由新增、补货/盘点和资料编辑页调用，卸载后阻止异步保存再次触发导航。
 */
export function createInventoryFormCompletionGuard() {
  let active = true;
  return {
    isActive: (): boolean => active,
    deactivate(): void {
      active = false;
    },
  };
}

/**
 * 统一管理库存表单的脏草稿返回保护与异步完成门禁。
 * 当前由 InventoryItemCreatePage、InventoryAdjustmentPage 和 InventoryItemProfileEditPage 调用。
 */
export function useInventoryFormLifecycle() {
  const protection = createInventoryDraftProtectionController({
    wechat: typeof wx === "undefined" ? undefined : wx,
  });
  const completionGuard = createInventoryFormCompletionGuard();

  onBeforeUnmount(() => {
    completionGuard.deactivate();
    protection.resetDirty();
  });

  return { ...protection, completionGuard };
}
