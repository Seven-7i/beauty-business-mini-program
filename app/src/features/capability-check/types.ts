/** 单项检查的页面状态；微信面板返回后可进入待确认或已取消，而不误判通过。 */
export type CapabilityStatus =
  | "idle"
  | "running"
  | "awaiting-confirmation"
  | "passed"
  | "cancelled"
  | "failed";

/** 页面渲染一项能力检查所需的稳定标识、状态和用户可读说明。 */
export interface CapabilityResult {
  /** 能力检查的稳定标识，用于更新对应检查结果。 */
  id:
    | "storage"
    | "json-file"
    | "rollback"
    | "segmented-index"
    | "capacity-rollback"
    | "share"
    | "choose";
  /** 展示给用户的检查项名称。 */
  label: string;
  /** 当前检查状态。 */
  status: CapabilityStatus;
  /** 当前进度、成功结果或原始失败原因。 */
  detail: string;
}
