import { onBeforeUnmount } from "vue";

/** 顾客表单使用的微信原生返回询问最小接口。 */
export interface WechatBeforeUnloadApi {
  /** 开启原生导航返回询问。 */
  enableAlertBeforeUnload(options: { message: string }): void;
  /** 关闭原生导航返回询问。 */
  disableAlertBeforeUnload(): void;
}

declare const wx: WechatBeforeUnloadApi | undefined;

/** 可测试的顾客草稿保护运行时依赖。 */
export interface CustomerDraftProtectionRuntime {
  /** 微信原生返回保护；非微信环境可以省略。 */
  wechat?: WechatBeforeUnloadApi;
}

/**
 * 创建顾客草稿保护控制器。
 * 当前由 `useCustomerDraftProtection` 调用，测试可注入微信与确认框替身验证状态边界。
 */
export function createCustomerDraftProtectionController(
  runtime: CustomerDraftProtectionRuntime,
) {
  let dirty = false;

  /** 把当前草稿状态同步到微信原生返回保护。 */
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

  /** 在保存或离开后解除原生返回保护。 */
  function resetDirty(): void {
    updateDirty(false);
  }

  /** 保存期间说明离开不会取消已提交写入；保存失败后恢复原草稿保护。 */
  function updateSaving(saving: boolean): void {
    if (!runtime.wechat) {
      return;
    }
    if (saving) {
      runtime.wechat.enableAlertBeforeUnload({
        message: "顾客资料正在保存，离开后仍会完成保存。",
      });
      return;
    }
    updateDirty(dirty);
  }

  return { updateDirty, resetDirty, updateSaving };
}

/**
 * 统一管理顾客表单的脏草稿返回保护和放弃确认。
 * 当前由 `CustomerEditor` 的独立新增与编辑模式共同调用。
 */
export function useCustomerDraftProtection() {
  const protection = createCustomerDraftProtectionController({
    wechat: typeof wx === "undefined" ? undefined : wx,
  });

  onBeforeUnmount(protection.resetDirty);

  return protection;
}
