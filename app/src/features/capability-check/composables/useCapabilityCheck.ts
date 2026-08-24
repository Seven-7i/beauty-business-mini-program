import { onScopeDispose, readonly, reactive, shallowRef } from "vue";
import type { StorageAdapter } from "@/infrastructure/storage/uni-storage-adapter";
import {
  WechatFileOperationError,
  type BackupFileAdapter,
  type LocalJsonFile,
} from "@/infrastructure/wechat/backup-file-adapter";
import { runRecoveryRollbackProbe } from "@/services/recovery-rollback-probe";
import { runCapacityRollbackProbe } from "@/services/capacity-rollback-probe";
import { runSegmentedIndexProbe } from "@/services/segmented-index-probe";
import { createBackupFileName } from "@/utils/backup-file-name";
import type {
  CapabilityResult,
  CapabilityStatus,
} from "../types";

const STORAGE_WARNING_KB = 7 * 1024;
let activeCapabilityCheck: "automated" | "manual" | undefined;

/** 能力检查依赖，只暴露跨端 Storage 与微信文件两个基础设施边界。 */
interface UseCapabilityCheckOptions {
  storage: StorageAdapter;
  files: BackupFileAdapter;
}

/** 微信面板返回后仍需用户确认的检查结果，避免把接口成功误判为业务成功。 */
interface PendingConfirmationResult {
  /** 表示平台回调不足以证明业务动作完成，必须等待用户明确确认。 */
  status: "awaiting-confirmation";
  /** 向用户说明为什么需要确认以及下一步操作。 */
  detail: string;
}

/** 普通成功文案，或需要额外用户确认的检查结果。 */
type CapabilityCheckResult = string | PendingConfirmationResult;

/** 同时保留主操作失败与临时文件清理失败，避免后一个错误覆盖前一个。 */
class CleanupFailureError extends Error {
  readonly primaryError: unknown;
  readonly cleanupError: unknown;

  constructor(primaryError: unknown, cleanupError: unknown) {
    super("操作失败且临时文件清理失败");
    this.primaryError = primaryError;
    this.cleanupError = cleanupError;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof CleanupFailureError) {
    return `${getErrorMessage(error.primaryError)}；临时文件清理失败：${getErrorMessage(error.cleanupError)}`;
  }

  if (error instanceof WechatFileOperationError && error.cancelled) {
    return "已取消本次操作";
  }

  if (error instanceof WechatFileOperationError) {
    const errorCode = error.errno ?? error.errCode;
    return errorCode === undefined
      ? error.message
      : `${error.message}（错误码：${errorCode}）`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "发生未知错误";
}

/**
 * 编排阶段 0 的自动检查与真机交互检查。
 *
 * 页面只消费响应式检查结果和显式动作；Storage、文件系统及微信聊天 API
 * 均通过注入的适配器执行，便于隔离业务数据并建立回归测试。
 */
export function useCapabilityCheck(options: UseCapabilityCheckOptions) {
  const { storage, files } = options;
  const jsonProbeFileName = `bm-stage0-json-probe-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
  let scopeActive = true;
  // wx.shareFileMessage 必须由用户点击同步触发，因此测试文件要在点击前准备好。
  let preparedShareProbe: LocalJsonFile | undefined;
  const checks = reactive<CapabilityResult[]>([
    { id: "storage", label: "Storage 容量信息", status: "idle", detail: "等待检查" },
    { id: "json-file", label: "JSON 文件读写", status: "idle", detail: "等待检查" },
    { id: "rollback", label: "失败回滚临时文件", status: "idle", detail: "等待检查" },
    { id: "segmented-index", label: "分片索引异常恢复", status: "idle", detail: "等待检查" },
    {
      id: "capacity-rollback",
      label: "接近 7MB 时文件回滚",
      status: "idle",
      detail: "需要真机手动运行，将短暂写入并清理隔离数据",
    },
    { id: "share", label: "微信文件转发", status: "idle", detail: "需要真机手动验证" },
    { id: "choose", label: "聊天文件选择", status: "idle", detail: "需要真机手动验证" },
  ]);
  const runningAutomatedChecks = shallowRef(false);
  const runningManualCheck = shallowRef(false);

  onScopeDispose(() => {
    scopeActive = false;

    if (preparedShareProbe) {
      void files.removeFile(preparedShareProbe.path).catch(() => undefined);
      preparedShareProbe = undefined;
    }
  });

  function updateCheck(
    id: CapabilityResult["id"],
    status: CapabilityStatus,
    detail: string,
  ): void {
    if (!scopeActive) {
      return;
    }

    const check = checks.find((item) => item.id === id);

    if (check) {
      check.status = status;
      check.detail = detail;
    }
  }

  async function runCheck(
    id: CapabilityResult["id"],
    task: () => Promise<CapabilityCheckResult>,
  ): Promise<void> {
    updateCheck(id, "running", "检查中…");

    try {
      const result = await task();
      if (typeof result === "string") {
        updateCheck(id, "passed", result);
      } else {
        updateCheck(id, result.status, result.detail);
      }
    } catch (error) {
      const status =
        error instanceof WechatFileOperationError && error.cancelled
          ? "cancelled"
          : "failed";
      updateCheck(id, status, getErrorMessage(error));
    }
  }

  async function checkStorage(): Promise<string> {
    const info = await storage.getCapacityInfo();
    const warning = info.currentSizeKb >= STORAGE_WARNING_KB ? "，已达到 7MB 提醒线" : "";
    return `${info.currentSizeKb}KB / ${info.limitSizeKb}KB，${info.keys.length} 个 key${warning}`;
  }

  async function checkJsonFile(): Promise<string> {
    const expected = JSON.stringify({
      kind: "stage0-json-probe",
      createdAt: new Date().toISOString(),
    });
    const file = await files.createJsonFile(jsonProbeFileName, expected);

    return withFileCleanup(file.path, async () => {
      const actual = await files.readTextFile(file.path);

      if (actual !== expected) {
        throw new Error("写入与读回内容不一致");
      }

      JSON.parse(actual);
      return "UTF-8 JSON 写入、读回与解析正常";
    });
  }

  /** 在用户点击之前生成转发文件，确保点击时可以同步调用微信转发 API。 */
  async function prepareShareProbe(): Promise<void> {
    if (preparedShareProbe) {
      return;
    }

    updateCheck("share", "running", "正在准备真机转发测试文件…");
    const now = new Date();
    const contents = JSON.stringify(
      {
        format: "beauty-local-backup-capability-check",
        createdAt: now.toISOString(),
        note: "此文件只用于阶段 0 微信转发能力验证，不包含业务数据。",
      },
      null,
      2,
    );

    try {
      const file = await files.createJsonFile(createBackupFileName(now), contents);

      if (!scopeActive) {
        await files.removeFile(file.path);
        return;
      }

      preparedShareProbe = file;
      updateCheck("share", "idle", "测试文件已准备，请点击下方按钮转发");
    } catch (error) {
      updateCheck("share", "failed", `测试文件准备失败：${getErrorMessage(error)}`);
    }
  }

  /** 执行一次性文件操作并在成功或失败后清理临时文件。 */
  async function withFileCleanup<T>(
    filePath: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    let result: T | undefined;
    let primaryError: unknown;

    try {
      result = await operation();
    } catch (error) {
      primaryError = error;
    }

    try {
      await files.removeFile(filePath);
    } catch (cleanupError) {
      if (primaryError !== undefined) {
        throw new CleanupFailureError(primaryError, cleanupError);
      }

      throw cleanupError;
    }

    if (primaryError !== undefined) {
      throw primaryError;
    }

    return result as T;
  }

  async function runAutomatedChecks(): Promise<void> {
    if (runningAutomatedChecks.value || activeCapabilityCheck !== undefined) {
      return;
    }

    activeCapabilityCheck = "automated";
    runningAutomatedChecks.value = true;

    try {
      await prepareShareProbe();
      await runCheck("storage", checkStorage);
      await runCheck("json-file", checkJsonFile);
      await runCheck("rollback", async () => {
        await runRecoveryRollbackProbe(storage, files);
        return "候选数据写入后已从临时快照恢复原数据";
      });
      await runCheck("segmented-index", async () => {
        const result = await runSegmentedIndexProbe(storage);
        return `${result.itemCount} 项拆为 ${result.shardCount} 片，异常写入后已恢复`;
      });
    } finally {
      if (activeCapabilityCheck === "automated") {
        activeCapabilityCheck = undefined;
      }

      if (scopeActive) {
        runningAutomatedChecks.value = false;
      }
    }
  }

  /** 串行执行需要微信原生界面的检查，防止两个选择面板互相覆盖。 */
  async function runManualCheck(
    id: "capacity-rollback" | "share" | "choose",
    task: () => Promise<CapabilityCheckResult>,
  ): Promise<void> {
    if (activeCapabilityCheck !== undefined) {
      const runningLabel =
        activeCapabilityCheck === "automated" ? "自动检查" : "另一项真机检查";
      updateCheck(id, "failed", `${runningLabel}正在运行，请稍后再试`);
      return;
    }

    activeCapabilityCheck = "manual";
    runningManualCheck.value = true;

    try {
      await runCheck(id, task);
    } finally {
      if (activeCapabilityCheck === "manual") {
        activeCapabilityCheck = undefined;
      }

      if (scopeActive) {
        runningManualCheck.value = false;
      }
    }
  }

  /** 临时填充隔离数据到约 7MB，并验证文件回滚不受 Storage 剩余空间影响。 */
  async function checkCapacityRollback(): Promise<void> {
    await runManualCheck("capacity-rollback", async () => {
      const result = await runCapacityRollbackProbe(storage, files);
      return `峰值 ${result.peakSizeKb}KB，${result.fillerKeyCount} 个隔离 key 已清理，当前 ${result.finalSizeKb}KB`;
    });
  }

  /** 在用户点击调用栈中立即调起文件转发，并保留源文件供聊天发送。 */
  async function checkShare(): Promise<void> {
    const file = preparedShareProbe;

    if (!file) {
      updateCheck("share", "failed", "测试文件尚未准备好，请先重新运行自动检查");
      return;
    }

    await runManualCheck("share", async () => {
      // 不要在此调用前增加 await，否则微信会判定调用脱离用户 TAP 手势。
      const shareResult = files.shareFile(file);
      await shareResult;

      // 微信 success 不能证明用户已把文件发进聊天；真机取消也可能走 success。
      // 因此保留源文件，并要求用户明确确认实际结果后再判定通过或取消。
      return {
        status: "awaiting-confirmation",
        detail: "转发面板已返回；微信无法确认是否实际发送，请确认实际结果",
      };
    });
  }

  /** 用户核对聊天后，明确确认测试文件已经实际发送。 */
  function confirmShareSent(): void {
    const share = checks.find((item) => item.id === "share");
    if (share?.status !== "awaiting-confirmation") {
      return;
    }

    updateCheck("share", "passed", "已确认测试文件发送成功");
  }

  /** 用户从转发面板取消后，明确记录取消结果且不误判为失败或成功。 */
  function confirmShareCancelled(): void {
    const share = checks.find((item) => item.id === "share");
    if (share?.status !== "awaiting-confirmation") {
      return;
    }

    updateCheck("share", "cancelled", "已取消本次操作");
  }

  /** 选择聊天 JSON 后只读解析，不写入 Storage 或执行恢复。 */
  async function checkChoose(): Promise<void> {
    await runManualCheck("choose", async () => {
      const file = await files.chooseJsonFile();
      const contents = await files.readTextFile(file.path);
      JSON.parse(contents);
      const sizeKb = Math.max(1, Math.ceil(file.sizeBytes / 1024));
      return `已读取 ${file.name}（约 ${sizeKb}KB），未写入 Storage`;
    });
  }

  return {
    checks: readonly(checks),
    runningAutomatedChecks: readonly(runningAutomatedChecks),
    runningManualCheck: readonly(runningManualCheck),
    runAutomatedChecks,
    checkCapacityRollback,
    checkShare,
    confirmShareSent,
    confirmShareCancelled,
    checkChoose,
  };
}
