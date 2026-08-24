import type { StorageCapacityService } from "@/services/storage-capacity-service";

export interface UseStorageCapacityReminderOptions {
  service: Pick<StorageCapacityService, "readSummary">;
  openBackupRestore: () => void;
  openHistoryCleanup: () => void;
}

/**
 * 容量达到产品 7MB 目标线时，每次应用运行周期最多提示一次。
 * 提醒只引导用户备份或手动清理，不写 Storage，也不自动删除业务记录。
 */
export function useStorageCapacityReminder(
  options: UseStorageCapacityReminderOptions,
) {
  const { service, openBackupRestore, openHistoryCleanup } = options;
  let warningShown = false;
  let inFlight: Promise<boolean> | undefined;

  async function runCheck(): Promise<boolean> {
    try {
      const summary = await service.readSummary();
      if (summary.status === "within-target") {
        warningShown = false;
        return false;
      }
      if (warningShown) {
        // 容量仍超线时持续压住低优先级七天提醒，但本运行周期不重复弹窗。
        return true;
      }
      warningShown = true;
      return await new Promise<boolean>((resolve) => {
        uni.showModal({
          title: "本机存储已达 7MB",
          content:
            "为备份、恢复和数据写入保留空间，请先导出完整备份，再按日期手动清理不再需要的预约历史。系统不会自动删除数据。",
          confirmText: "立即备份",
          cancelText: "清理历史",
          success(result) {
            if (result.confirm) {
              openBackupRestore();
            } else if (result.cancel) {
              openHistoryCleanup();
            }
            resolve(true);
          },
          fail() {
            warningShown = false;
            resolve(false);
          },
        });
      });
    } catch {
      warningShown = false;
      return false;
    }
  }

  function checkStorageCapacity(): Promise<boolean> {
    if (inFlight) {
      return inFlight;
    }
    inFlight = runCheck().finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  }

  return { checkStorageCapacity };
}
