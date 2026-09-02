import { onBeforeUnmount } from "vue";
import { requestCustomerFormExit } from "../customer-form-state";

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
  /** 打开放弃确认，并在用户确认时执行传入动作。 */
  confirmDiscard(discard: () => void): void;
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

  /** 请求退出表单，存在修改时先取得明确确认。 */
  function requestExit(exit: () => void): void {
    requestCustomerFormExit({
      dirty,
      exit,
      confirmDiscard: runtime.confirmDiscard,
    });
  }

  return { updateDirty, resetDirty, requestExit };
}

/**
 * 统一管理顾客表单的脏草稿返回保护和放弃确认。
 * 当前由 `CustomerCreate` 独立新增页和 `CustomerDetailPage` 独立编辑流程调用。
 */
export function useCustomerDraftProtection() {
  const protection = createCustomerDraftProtectionController({
    wechat: typeof wx === "undefined" ? undefined : wx,
    confirmDiscard(discard) {
      uni.showModal({
        title: "放弃本次编辑？",
        content: "尚未保存的顾客资料将丢失。",
        confirmText: "放弃",
        confirmColor: "#A94442",
        success(result) {
          if (result.confirm) {
            discard();
          }
        },
        fail() {
          uni.showToast({ title: "确认框打开失败", icon: "none" });
        },
      });
    },
  });

  onBeforeUnmount(protection.resetDirty);

  return protection;
}
