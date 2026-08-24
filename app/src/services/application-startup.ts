import type {
  ApplicationDataRepository,
  InterruptedRecoveryResult,
} from "@/repositories/application-data-repository";

let activeRecovery: Promise<InterruptedRecoveryResult> | undefined;

/**
 * 合并同一时刻由 App 和首个页面发起的启动恢复检查。
 * 完成后释放缓存，使 reLaunch 后仍会重新检查后来产生的中断事务。
 */
export async function ensureApplicationDataRecovered(
  repository: Pick<ApplicationDataRepository, "recoverInterruptedReplace">,
): Promise<InterruptedRecoveryResult> {
  if (activeRecovery) {
    return activeRecovery;
  }
  const attempt = repository.recoverInterruptedReplace();
  activeRecovery = attempt;
  try {
    return await attempt;
  } finally {
    if (activeRecovery === attempt) {
      activeRecovery = undefined;
    }
  }
}
