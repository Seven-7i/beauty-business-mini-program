export interface StartupExportConfirmationCoordinatorOptions {
  runConfirmationFlow: () => Promise<StartupExportConfirmationResult>;
}

export interface StartupExportConfirmationResult {
  handledPending: boolean;
}

export interface RetryStartupExportConfirmationOptions {
  attempt: () => Promise<StartupExportConfirmationResult>;
  waitBeforeRetry: (failedAttemptCount: number) => Promise<void>;
  waitForManualRetry?: (error: unknown) => Promise<void>;
  maxAutomaticAttempts?: number;
}

/**
 * 瞬时故障有限退避；连续失败后暂停在显式人工重试，不持续轮询本机存储。
 * 门禁在成功前不会被误判为“没有待确认”。
 */
export async function retryStartupExportConfirmation(
  options: RetryStartupExportConfirmationOptions,
): Promise<StartupExportConfirmationResult> {
  const maxAutomaticAttempts = options.maxAutomaticAttempts ?? 4;
  let failedAttemptCount = 0;
  while (true) {
    try {
      return await options.attempt();
    } catch (error) {
      failedAttemptCount += 1;
      if (failedAttemptCount < maxAutomaticAttempts) {
        await options.waitBeforeRetry(failedAttemptCount);
        continue;
      }
      if (!options.waitForManualRetry) throw error;
      await options.waitForManualRetry(error);
      failedAttemptCount = 0;
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
