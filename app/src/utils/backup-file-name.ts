function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

/** 用户可见备份文件的范围，用不同前缀避免同一分钟内互相覆盖。 */
export type BackupFileNameScope = "legacy" | "system" | "beauty";

export function createBackupFileName(
  createdAt: Date,
  scope: BackupFileNameScope = "legacy",
): string {
  const date = [
    createdAt.getFullYear(),
    pad(createdAt.getMonth() + 1),
    pad(createdAt.getDate()),
  ].join("");
  const time = [pad(createdAt.getHours()), pad(createdAt.getMinutes())].join("");

  const prefix =
    scope === "system"
      ? "庄月空间系统备份"
      : scope === "beauty"
        ? "庄月空间美容备份"
        : "美容管家备份";
  return `${prefix}_${date}_${time}.json`;
}
