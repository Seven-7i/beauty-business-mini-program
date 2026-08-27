import type { StartupExportConfirmationResult } from "./startup-export-confirmation-coordinator";

let startupExportConfirmationGate: Promise<StartupExportConfirmationResult> =
  Promise.resolve({ handledPending: false });
let handledPendingSuppressionConsumed = false;

/** App 启动时安装一次全局待确认门禁，所有页面级保护提醒都必须等待它完成。 */
export function setStartupExportConfirmationGate(
  gate: Promise<StartupExportConfirmationResult>,
): void {
  startupExportConfirmationGate = gate;
  handledPendingSuppressionConsumed = false;
}

/** 等待“上次导出尚未确认”处理完成，避免普通提醒与其争抢弹窗。 */
export async function waitForStartupExportConfirmation(): Promise<StartupExportConfirmationResult> {
  const result = await startupExportConfirmationGate;
  if (!result.handledPending || handledPendingSuppressionConsumed) {
    return { handledPending: false };
  }
  handledPendingSuppressionConsumed = true;
  return result;
}
