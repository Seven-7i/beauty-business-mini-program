import type { ApplicationData } from "@/domain/data-schema";
import type { ApplicationDataRepository } from "@/repositories/application-data-repository";

const BACKUP_REMINDER_INTERVAL_DAYS = 7;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** 备份提醒只需要读取快照和写入提醒日期，不暴露恢复写入能力。 */
export type BackupReminderRepository = Pick<
  ApplicationDataRepository,
  "readSnapshot" | "recordBackupReminderShown"
>;

export interface BackupReminderServiceOptions {
  repository: BackupReminderRepository;
  /** 注入当前时间以稳定测试；生产环境默认使用设备本地时间。 */
  now?: () => Date;
}

function toLocalDateParts(date: Date): [number, number, number] {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()];
}

/** 返回 YYYY-MM-DD；提醒去重以用户设备的本地自然日为准。 */
function formatLocalDate(date: Date): string {
  const [year, month, day] = toLocalDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function localCalendarDayNumber(date: Date): number {
  const [year, month, day] = toLocalDateParts(date);
  // 使用本地年月日映射到 UTC 日序号，避免夏令时造成 23/25 小时误差。
  return Math.floor(Date.UTC(year, month - 1, day) / MILLISECONDS_PER_DAY);
}

function earliestBusinessRecordDate(data: ApplicationData): Date | undefined {
  const timestamps = [
    ...data.inventoryItems,
    ...data.inventoryMovements,
    ...data.projects,
    ...data.customers,
    ...data.appointments,
  ].map((record) => record.createdAt);
  if (timestamps.length === 0) {
    return undefined;
  }
  return new Date(timestamps.reduce((earliest, value) =>
    value < earliest ? value : earliest,
  ));
}

/**
 * 判断是否到达七天提醒周期，并在返回 true 前先占用当天提醒名额。
 * 先记录再展示可保证页面重复挂载时，同一天最多弹出一次。
 */
export function createBackupReminderService(
  options: BackupReminderServiceOptions,
) {
  const { repository, now = () => new Date() } = options;

  async function claimDueReminder(): Promise<boolean> {
    const data = await repository.readSnapshot();
    const today = now();
    const todayText = formatLocalDate(today);
    if (data.backupMetadata.lastReminderDate === todayText) {
      return false;
    }

    const baseline = data.backupMetadata.lastExportedAt
      ? new Date(data.backupMetadata.lastExportedAt)
      : data.backupMetadata.firstBusinessDataAt
        ? new Date(data.backupMetadata.firstBusinessDataAt)
        : earliestBusinessRecordDate(data);
    if (baseline === undefined) {
      return false;
    }

    const elapsedDays =
      localCalendarDayNumber(today) - localCalendarDayNumber(baseline);
    if (elapsedDays < BACKUP_REMINDER_INTERVAL_DAYS) {
      return false;
    }

    await repository.recordBackupReminderShown(todayText);
    return true;
  }

  return { claimDueReminder };
}

export type BackupReminderService = ReturnType<
  typeof createBackupReminderService
>;
