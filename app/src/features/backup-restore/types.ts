import type { BackupDataSummary } from "@/services/backup-envelope";

/** 产品备份导出区当前所处的交互状态。 */
export type BackupExportStatus =
  | "idle"
  | "preparing"
  | "ready"
  | "sharing"
  | "awaiting-confirmation"
  | "recording"
  | "cleaning"
  | "completed"
  | "cancelled"
  | "failed";

/** 产品恢复区当前所处的交互状态。 */
export type BackupRestoreStatus =
  | "idle"
  | "selecting"
  | "ready"
  | "restoring"
  | "completed"
  | "interrupted"
  | "cancelled"
  | "failed";

/** 导出区展示状态；修改只能通过 composable 暴露的动作发生。 */
export interface BackupExportViewState {
  status: BackupExportStatus;
  detail: string;
  fileName?: string;
}

/** 恢复确认区可公开给组件展示的安全摘要，不暴露完整顾客数据。 */
export interface BackupRestoreCandidateView {
  fileName: string;
  sizeBytes: number;
  createdAt: string;
  appVersion: string;
  summary: BackupDataSummary;
  currentHasBusinessData: boolean;
  /** 用于确认覆盖边界的用户可见范围名称。 */
  scopeLabel: string;
  /** 系统恢复与模块恢复使用不同的风险提示。 */
  scopeKind: "system" | "modules";
}

/** 恢复区展示状态。 */
export interface BackupRestoreViewState {
  status: BackupRestoreStatus;
  detail: string;
  candidate?: BackupRestoreCandidateView;
  /** 从恢复确认页发起的当前数据导出是否已实际发送。 */
  currentDataExportStatus: "idle" | "in-progress" | "completed";
}
