import type { BackupReminderService } from "@/services/backup-reminder-service";

export interface UseBackupReminderOptions {
  service: BackupReminderService;
  openBackupRestore: () => void;
}

function currentLocalDate(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

/** 同一本地自然日最多检查一次；跨夜从后台返回时会重新检查。 */
export function useBackupReminder(options: UseBackupReminderOptions) {
  const { service, openBackupRestore } = options;
  let checkedDate: string | undefined;

  async function checkBackupReminder(): Promise<void> {
    const today = currentLocalDate();
    if (checkedDate === today) {
      return;
    }
    checkedDate = today;
    try {
      if (!(await service.claimDueReminder())) {
        return;
      }
      uni.showModal({
        title: "建议备份数据",
        content: "距离首次记录或上次成功导出已满 7 天。建议现在导出一份完整备份，防止换机或清除缓存后丢失。",
        confirmText: "立即备份",
        cancelText: "稍后",
        success(result) {
          if (result.confirm) {
            openBackupRestore();
          }
        },
      });
    } catch {
      // 提醒失败不能阻止用户进入工作台；下一次重新进入应用时会再次尝试。
      checkedDate = undefined;
    }
  }

  return { checkBackupReminder };
}
