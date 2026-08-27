<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
import { APP_VERSION } from "@/config/app";
import {
  createUniStorageAdapter,
  type UniStorageRuntime,
} from "@/infrastructure/storage/uni-storage-adapter";
import { createDefaultWechatBackupFileAdapter } from "@/infrastructure/wechat/backup-file-adapter";
import { createApplicationDataRepository } from "@/repositories/application-data-repository";
import { ensureApplicationDataRecovered } from "@/services/application-startup";
import {
  createPendingExportConfirmationService,
  PendingExportSentDecisionCommittedError,
  type PendingExportConfirmation,
} from "@/services/pending-export-confirmation-service";
import { setStartupExportConfirmationGate } from "@/services/startup-export-confirmation-gate";
import {
  createStartupExportConfirmationCoordinator,
  retryStartupExportConfirmation,
} from "@/services/startup-export-confirmation-coordinator";

const GENERATED_BACKUP_SAFETY_MILLISECONDS = 15 * 60 * 1000;
let appFiles: ReturnType<typeof createDefaultWechatBackupFileAdapter> | undefined;
let startupExportConfirmationCoordinator: ReturnType<
  typeof createStartupExportConfirmationCoordinator
> | undefined;

function waitBeforeRetry(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 800));
}

function showPendingExportConfirmation(
  service: ReturnType<typeof createPendingExportConfirmationService>,
  pending: PendingExportConfirmation,
): Promise<"completed" | "sent-committed"> {
  return new Promise((resolve) => {
    const scopeLabel = pending.scopeKind === "system" ? "完整系统备份" : "美容模块备份";
    function prompt(retrying = false): void {
      uni.showModal({
        title: retrying ? "请重新确认上次导出" : "上次导出尚未确认",
        content: retrying
          ? `刚才的确认结果未能保存。请再次确认${scopeLabel}“${pending.fileName}”是否已发送。`
          : `上次生成的${scopeLabel}“${pending.fileName}”还没有确认发送结果。请按微信聊天中的实际情况选择。`,
        confirmText: "已发送",
        cancelText: "未发送",
        confirmColor: "#9A565D",
        success(result) {
          void (async () => {
            try {
              if (result.confirm) {
                await service.confirmSent(pending);
                uni.showToast({
                  title: pending.scopeKind === "system" ? "已记录最近导出" : "已确认发送",
                  icon: "success",
                });
              } else {
                await service.confirmNotSent(pending);
                uni.showToast({ title: "已标记为未发送", icon: "none" });
              }
              resolve("completed");
            } catch (error) {
              if (error instanceof PendingExportSentDecisionCommittedError) {
                // 已发送决定已经落盘，交还外层读取 sent 阶段并自动单向完成。
                resolve("sent-committed");
                return;
              }
              // 门禁继续保持；同次启动重试，冷启动时 Storage 状态也仍然存在。
              uni.showToast({ title: "确认结果保存失败，请重试", icon: "none" });
              await waitBeforeRetry();
              prompt(true);
            }
          })();
        },
        fail() {
          void (async () => {
            uni.showToast({ title: "提示打开失败，正在重试", icon: "none" });
            await waitBeforeRetry();
            prompt(true);
          })();
        },
      });
    }
    prompt();
  });
}

async function handleStartupExportConfirmation(
  service: ReturnType<typeof createPendingExportConfirmationService>,
): Promise<{ handledPending: boolean }> {
  while (true) {
    try {
      const pending = await service.read();
      if (pending) {
        if (pending.decision === "sent") {
          try {
            await service.confirmSent(pending);
            uni.showToast({ title: "已完成上次导出记录", icon: "success" });
          } catch {
            uni.showToast({ title: "正在重试完成上次导出记录", icon: "none" });
            await waitBeforeRetry();
            continue;
          }
        } else {
          const result = await showPendingExportConfirmation(service, pending);
          if (result === "sent-committed") {
            continue;
          }
        }
      }
      return { handledPending: pending !== undefined };
    } catch {
      // 不释放门禁，同次启动持续重试；普通容量/七天提醒不会抢先弹出。
      uni.showToast({ title: "上次导出状态读取失败，正在重试", icon: "none" });
      await waitBeforeRetry();
    }
  }
}

function cleanupExpiredGeneratedBackups(): void {
  void appFiles
    ?.removeGeneratedBackupFiles({
      createdBefore: new Date(Date.now() - GENERATED_BACKUP_SAFETY_MILLISECONDS),
    })
    .catch(() => undefined);
}

onLaunch(() => {
  const storage = createUniStorageAdapter(uni as unknown as UniStorageRuntime);
  const files = createDefaultWechatBackupFileAdapter();
  appFiles = files;
  const repository = createApplicationDataRepository({
    storage,
    rollbackFiles: files,
    appVersion: APP_VERSION,
  });
  const exportConfirmations = createPendingExportConfirmationService({
    storage,
    repository,
  });
  // 尽早启动恢复检查；首个页面会等待同一检查完成后再读取业务数据。
  startupExportConfirmationCoordinator ??=
    createStartupExportConfirmationCoordinator({
      runConfirmationFlow: () =>
        retryStartupExportConfirmation({
          attempt: async () => {
            await ensureApplicationDataRecovered(repository);
            return handleStartupExportConfirmation(exportConfirmations);
          },
          waitBeforeRetry,
        }),
    });
  setStartupExportConfirmationGate(
    startupExportConfirmationCoordinator.check(),
  );
  cleanupExpiredGeneratedBackups();
});

onShow(() => {
  // 从微信转发面板或后台返回时，安全年龄外的孤儿文件可继续幂等清理。
  cleanupExpiredGeneratedBackups();
});

onHide(() => {
  console.log("App Hide");
});
</script>

<style lang="scss">
page {
  min-height: 100%;
  background: #f8f9fb;
  color: #172033;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

button {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

button::after {
  border: none;
}
</style>
