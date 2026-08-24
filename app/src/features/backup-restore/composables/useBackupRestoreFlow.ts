import {
  computed,
  onScopeDispose,
  readonly,
  reactive,
  shallowRef,
} from "vue";
import { WechatFileOperationError } from "@/infrastructure/wechat/backup-file-adapter";
import { BackupEnvelopeError } from "@/services/backup-envelope";
import type {
  BackupRestoreService,
  PreparedBackupExport,
  SelectedBackupRestore,
} from "@/services/backup-restore-service";
import type { BackupScope } from "@/services/portable-backup-envelope";
import type {
  BackupExportViewState,
  BackupRestoreCandidateView,
  BackupRestoreViewState,
} from "../types";

/** 创建产品备份恢复 composable 所需的依赖。 */
export interface UseBackupRestoreFlowOptions {
  service: BackupRestoreService;
  /** 模块内数据页可把默认导出范围固定为当前模块。 */
  initialExportScope?: BackupScope;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof WechatFileOperationError && error.cancelled) {
    return "已取消本次操作";
  }
  if (error instanceof BackupEnvelopeError) {
    return error.message;
  }
  if (error instanceof WechatFileOperationError) {
    const errorCode = error.errno ?? error.errCode;
    return errorCode === undefined
      ? error.message
      : `${error.message}（错误码：${errorCode}）`;
  }
  return error instanceof Error ? error.message : "发生未知错误";
}

function toCandidateView(
  selected: SelectedBackupRestore,
  currentHasBusinessData: boolean,
): BackupRestoreCandidateView {
  return {
    fileName: selected.file.name,
    sizeBytes: selected.file.sizeBytes,
    createdAt: selected.createdAt,
    appVersion: selected.appVersion,
    summary: selected.summary,
    currentHasBusinessData,
    scopeKind: selected.scope.kind,
    scopeLabel:
      selected.scope.kind === "system"
        ? "完整系统"
        : selected.scope.moduleIds.includes("beauty")
          ? "美容模块"
          : "所选模块",
  };
}

/**
 * 管理产品备份恢复页面的单一状态源。
 * 完整候选数据和本地文件引用只保留在 composable 内，展示组件仅接收摘要。
 */
export function useBackupRestoreFlow(options: UseBackupRestoreFlowOptions) {
  const { service } = options;
  const exportScope = shallowRef<BackupScope>(
    options.initialExportScope ?? { kind: "system" },
  );
  const preparedExport = shallowRef<PreparedBackupExport>();
  const selectedRestore = shallowRef<SelectedBackupRestore>();
  const lastExportedAt = shallowRef<string>();
  const lastExportFileName = shallowRef<string>();
  const exportState = reactive<BackupExportViewState>({
    status: "idle",
    detail: "生成后由你在微信中手动选择联系人转发",
  });
  const restoreState = reactive<BackupRestoreViewState>({
    status: "idle",
    detail: "从微信聊天选择由本应用生成的 JSON 备份",
    currentDataExportStatus: "idle",
  });
  let scopeActive = true;

  const busy = computed(
    () =>
      ["preparing", "sharing", "recording", "cleaning"].includes(
        exportState.status,
      ) ||
      ["selecting", "restoring"].includes(restoreState.status),
  );

  onScopeDispose(() => {
    scopeActive = false;
    const prepared = preparedExport.value;
    if (
      prepared &&
      !["sharing", "awaiting-confirmation", "recording"].includes(
        exportState.status,
      )
    ) {
      // 未开始分享的文件可直接清理；未决分享留给下次页面启动安全清理。
      void service.removePreparedExport(prepared).catch(() => undefined);
      preparedExport.value = undefined;
    }
  });

  async function initialize(): Promise<void> {
    try {
      await service.cleanupStaleExportFiles();
      const overview = await service.readOverview();
      if (!scopeActive) {
        return;
      }
      lastExportedAt.value = overview.lastExportedAt;
      lastExportFileName.value = overview.lastExportFileName;
    } catch (error) {
      if (scopeActive) {
        exportState.status = "failed";
        exportState.detail = `读取最近导出信息失败：${getErrorMessage(error)}`;
      }
    }
  }

  async function cleanupPreparedExport(
    prepared: PreparedBackupExport,
  ): Promise<string | undefined> {
    try {
      await service.removePreparedExport(prepared);
      if (preparedExport.value?.file.path === prepared.file.path) {
        preparedExport.value = undefined;
        exportState.fileName = undefined;
      }
      return undefined;
    } catch (error) {
      return getErrorMessage(error);
    }
  }

  async function prepareExport(scope: BackupScope = exportScope.value): Promise<void> {
    if (busy.value) {
      return;
    }
    exportState.status = "preparing";
    exportState.detail = "正在汇总本机数据并生成完整性校验…";

    try {
      const previous = preparedExport.value;
      if (previous) {
        await service.removePreparedExport(previous);
      }
      const prepared = await service.prepareExport(scope);
      if (!scopeActive) {
        await service.removePreparedExport(prepared);
        return;
      }
      preparedExport.value = prepared;
      exportState.status = "ready";
      exportState.fileName = prepared.file.name;
      exportState.detail = "备份文件已生成，请点击下方按钮打开微信转发";
    } catch (error) {
      if (scopeActive) {
        exportState.status = "failed";
        exportState.detail = getErrorMessage(error);
      }
    }
  }

  async function sharePreparedExport(): Promise<void> {
    const prepared = preparedExport.value;
    if (!prepared || busy.value) {
      return;
    }

    exportState.status = "sharing";
    exportState.detail = "正在等待微信转发面板返回…";

    try {
      // 不要在此调用前增加 await，必须在用户 TAP 调用栈内立即进入微信 API。
      const sharing = service.sharePreparedExport(prepared);
      await sharing;
      if (scopeActive) {
        exportState.status = "awaiting-confirmation";
        exportState.detail = "微信无法判断是否实际发送，请按聊天中的结果确认";
      }
    } catch (error) {
      if (scopeActive) {
        const cancelled =
          error instanceof WechatFileOperationError && error.cancelled;
        exportState.status = "cleaning";
        const cleanupError = await cleanupPreparedExport(prepared);
        exportState.status = cancelled ? "cancelled" : "failed";
        exportState.detail = cleanupError
          ? `${getErrorMessage(error)}；临时文件将在下次进入时继续清理：${cleanupError}`
          : getErrorMessage(error);
        if (restoreState.currentDataExportStatus === "in-progress") {
          restoreState.currentDataExportStatus = "idle";
        }
      }
    }
  }

  async function confirmExportSent(): Promise<void> {
    const prepared = preparedExport.value;
    if (!prepared || exportState.status !== "awaiting-confirmation") {
      return;
    }

    exportState.status = "recording";
    exportState.detail = "正在记录最近导出时间…";
    try {
      await service.recordConfirmedExport(prepared);
      if (!scopeActive) {
        return;
      }
      if (prepared.scope.kind === "system") {
        lastExportedAt.value = prepared.createdAt;
        lastExportFileName.value = prepared.file.name;
      }
      exportState.status = "cleaning";
      const cleanupError = await cleanupPreparedExport(prepared);
      if (restoreState.currentDataExportStatus === "in-progress") {
        restoreState.currentDataExportStatus = "completed";
      }
      exportState.status = "completed";
      const resultLabel =
        prepared.scope.kind === "system"
          ? "已确认转发并记录最近完整系统导出时间"
          : "已确认转发模块备份";
      exportState.detail = cleanupError
        ? `${resultLabel}；临时文件将在下次进入时继续清理：${cleanupError}`
        : `${resultLabel}，临时文件已清理`;
    } catch (error) {
      if (scopeActive) {
        // 文件可能已经发送，保留确认入口以便只重试元数据记录。
        exportState.status = "awaiting-confirmation";
        exportState.detail = `文件可能已发送，但记录导出时间失败，请重试：${getErrorMessage(error)}`;
      }
    }
  }

  async function confirmExportCancelled(): Promise<void> {
    if (exportState.status !== "awaiting-confirmation") {
      return;
    }
    exportState.status = "cleaning";
    const prepared = preparedExport.value;
    const cleanupError = prepared
      ? await cleanupPreparedExport(prepared)
      : undefined;
    exportState.status = "cancelled";
    exportState.detail = cleanupError
      ? `已取消，不会更新最近导出时间；临时文件将在下次进入时继续清理：${cleanupError}`
      : "已取消，不会更新最近导出时间，临时文件已清理";
    if (restoreState.currentDataExportStatus === "in-progress") {
      restoreState.currentDataExportStatus = "idle";
    }
  }

  async function prepareCurrentDataBeforeRestore(): Promise<void> {
    if (restoreState.status !== "ready") {
      return;
    }
    restoreState.currentDataExportStatus = "in-progress";
    await prepareExport(selectedRestore.value?.scope ?? exportScope.value);
    if (exportState.status === "failed") {
      restoreState.currentDataExportStatus = "idle";
    }
  }

  async function selectRestoreFile(): Promise<void> {
    if (
      busy.value ||
      restoreState.status === "interrupted" ||
      restoreState.status === "completed"
    ) {
      return;
    }
    selectedRestore.value = undefined;
    restoreState.candidate = undefined;
    restoreState.status = "selecting";
    restoreState.currentDataExportStatus = "idle";
    restoreState.detail = "正在读取并校验备份，校验期间不会改动本机数据…";

    try {
      // 不要在此调用前增加 await，保留微信文件选择所需的用户点击调用链。
      const selection = service.selectRestoreFile();
      const selected = await selection;
      if (!scopeActive) {
        return;
      }
      selectedRestore.value = selected;
      restoreState.detail = "备份校验通过，正在检查当前本机数据状态…";
      const currentHasBusinessData =
        await service.inspectCurrentDataForRestore(selected);
      if (!scopeActive) {
        return;
      }
      restoreState.candidate = toCandidateView(
        selected,
        currentHasBusinessData,
      );
      restoreState.status = "ready";
      restoreState.detail =
        selected.scope.kind === "system"
          ? currentHasBusinessData
            ? "校验通过；恢复将整体替换当前系统数据"
            : "校验通过；当前没有业务记录，可以完整恢复"
          : currentHasBusinessData
            ? "校验通过；只会替换文件声明的模块数据"
            : "校验通过；将恢复文件声明的模块数据";
    } catch (error) {
      if (scopeActive) {
        const cancelled =
          error instanceof WechatFileOperationError && error.cancelled;
        restoreState.status = cancelled ? "cancelled" : "failed";
        restoreState.detail = getErrorMessage(error);
      }
    }
  }

  async function confirmRestore(): Promise<void> {
    const selected = selectedRestore.value;
    if (!selected || restoreState.status !== "ready" || busy.value) {
      return;
    }
    restoreState.status = "restoring";
    restoreState.detail =
      selected.scope.kind === "system"
        ? "正在整体恢复并校验本地数据，请勿关闭小程序…"
        : "正在替换所选模块并校验本地数据，请勿关闭小程序…";

    try {
      await service.restoreSelectedBackup(selected);
      if (scopeActive) {
        restoreState.status = "completed";
        restoreState.detail =
          selected.scope.kind === "system"
            ? "备份已完整恢复，可以重新进入应用"
            : "模块备份已恢复，其他模块和系统设置未改变";
      }
    } catch (error) {
      if (scopeActive) {
        // 仓储已尝试回滚；若回滚也受阻，事务会留给下次启动继续处理。
        // 此时不允许直接选择另一份备份，避免在未决事务上继续叠加操作。
        restoreState.status = "interrupted";
        restoreState.detail = `恢复未完成，请重新进入应用以继续保护原数据：${getErrorMessage(error)}`;
      }
    }
  }

  function resetRestore(): void {
    if (busy.value || restoreState.status === "interrupted") {
      return;
    }
    selectedRestore.value = undefined;
    restoreState.candidate = undefined;
    restoreState.status = "idle";
    restoreState.currentDataExportStatus = "idle";
    restoreState.detail = "从微信聊天选择由本应用生成的 JSON 备份";
  }

  return {
    exportState: readonly(exportState),
    restoreState: readonly(restoreState),
    lastExportedAt: readonly(lastExportedAt),
    lastExportFileName: readonly(lastExportFileName),
    busy,
    exportScope: readonly(exportScope),
    setExportScope(scope: BackupScope) {
      if (!busy.value) {
        exportScope.value = scope;
      }
    },
    initialize,
    prepareExport,
    sharePreparedExport,
    confirmExportSent,
    confirmExportCancelled,
    prepareCurrentDataBeforeRestore,
    selectRestoreFile,
    confirmRestore,
    resetRestore,
  };
}
