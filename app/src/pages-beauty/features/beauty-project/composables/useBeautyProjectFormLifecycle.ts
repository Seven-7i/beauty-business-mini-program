import { onBeforeUnmount } from "vue";

/** 服务项目表单使用的微信原生返回询问最小接口。 */
export interface BeautyProjectBeforeUnloadApi {
  /** 开启原生导航返回询问。 */
  enableAlertBeforeUnload(options: { message: string }): void;
  /** 关闭原生导航返回询问。 */
  disableAlertBeforeUnload(): void;
}

declare const wx: BeautyProjectBeforeUnloadApi | undefined;

/** 可测试的服务项目表单草稿保护运行时依赖。 */
export interface BeautyProjectDraftProtectionRuntime {
  /** 微信原生返回保护；非微信环境可以省略。 */
  wechat?: BeautyProjectBeforeUnloadApi;
}

/**
 * 创建服务项目表单的原生返回保护控制器。
 * 当前由 useBeautyProjectFormLifecycle 调用，测试可注入微信 API 替身。
 */
export function createBeautyProjectDraftProtectionController(
  runtime: BeautyProjectDraftProtectionRuntime,
) {
  let dirty = false;
  let savingInProgress = false;

  /** 保存提示优先于草稿提示，避免提交触发的延迟 watch 覆盖真实状态。 */
  function syncProtection(): void {
    if (!runtime.wechat) {
      return;
    }
    if (savingInProgress) {
      runtime.wechat.enableAlertBeforeUnload({
        message: "服务项目正在保存，离开后仍会完成保存。",
      });
      return;
    }
    if (dirty) {
      runtime.wechat.enableAlertBeforeUnload({ message: "放弃本次编辑？" });
      return;
    }
    runtime.wechat.disableAlertBeforeUnload();
  }

  /** 同步草稿状态；有修改时询问是否放弃。 */
  function updateDirty(nextDirty: boolean): void {
    dirty = nextDirty;
    syncProtection();
  }

  /** 保存成功或组件卸载时解除返回保护。 */
  function resetDirty(): void {
    dirty = false;
    savingInProgress = false;
    syncProtection();
  }

  /** 保存期间说明离开不会取消已开始的原子写入，失败后恢复草稿保护。 */
  function updateSaving(saving: boolean): void {
    savingInProgress = saving;
    syncProtection();
  }

  return { updateDirty, resetDirty, updateSaving };
}

/**
 * 创建服务项目表单异步完成动作的生命周期门禁。
 * 当前由 BeautyProjectEditor 使用，卸载后阻止保存完成再次触发导航。
 */
export function createBeautyProjectFormCompletionGuard() {
  let active = true;
  return {
    isActive: (): boolean => active,
    deactivate(): void {
      active = false;
    },
  };
}

/** 统一管理服务项目表单的脏草稿返回保护与异步完成门禁。 */
export function useBeautyProjectFormLifecycle() {
  const protection = createBeautyProjectDraftProtectionController({
    wechat: typeof wx === "undefined" ? undefined : wx,
  });
  const completionGuard = createBeautyProjectFormCompletionGuard();

  onBeforeUnmount(() => {
    completionGuard.deactivate();
    protection.resetDirty();
  });

  return { ...protection, completionGuard };
}
