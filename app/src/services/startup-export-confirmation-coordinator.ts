export interface StartupExportConfirmationCoordinatorOptions {
  runConfirmationFlow: () => Promise<StartupExportConfirmationResult>;
}

export interface StartupExportConfirmationResult {
  handledPending: boolean;
}

export interface RetryStartupExportConfirmationOptions {
  attempt: () => Promise<StartupExportConfirmationResult>;
  waitBeforeRetry: () => Promise<void>;
}

/** 前置恢复失败时保持门禁并重试，不把“尚未检查”伪装成“没有待确认”。 */
export async function retryStartupExportConfirmation(
  options: RetryStartupExportConfirmationOptions,
): Promise<StartupExportConfirmationResult> {
  while (true) {
    try {
      return await options.attempt();
    } catch {
      await options.waitBeforeRetry();
    }
  }
}

/** 启动层调用的待确认导出协调器。 */
export function createStartupExportConfirmationCoordinator(
  options: StartupExportConfirmationCoordinatorOptions,
) {
  let confirmationFlow: Promise<StartupExportConfirmationResult> | undefined;

  return {
    check(): Promise<StartupExportConfirmationResult> {
      confirmationFlow ??= options.runConfirmationFlow();
      return confirmationFlow;
    },
  };
}
