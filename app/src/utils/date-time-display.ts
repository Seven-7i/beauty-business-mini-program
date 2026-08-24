import type { IsoDateTimeString } from "@/domain/data-schema";

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

/** 使用设备本地时区格式化已校验的 ISO 时间，避免依赖小程序 Intl 支持。 */
export function formatLocalDateTime(value?: IsoDateTimeString): string {
  if (!value) {
    return "尚未导出";
  }
  const date = new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 以便于手机阅读的 KB/MB 展示文件字节数。 */
export function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.ceil(sizeBytes / 1024))} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
