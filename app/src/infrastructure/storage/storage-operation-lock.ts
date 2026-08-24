let previousOperation = Promise.resolve();

/**
 * 串行执行会读写产品业务 key 的仓储操作。
 * 所有 managed-key writer 必须经过这里，避免整体恢复与普通保存交错后静默丢失更新。
 * 调用方不得在已持有该锁的 operation 内再次调用本函数。
 */
export async function runExclusiveStorageOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const waitForPrevious = previousOperation;
  let release: () => void = () => undefined;
  previousOperation = new Promise<void>((resolve) => {
    release = resolve;
  });

  await waitForPrevious;
  try {
    return await operation();
  } finally {
    release();
  }
}
