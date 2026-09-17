import { describe, expect, it } from "vitest";
import {
  createStartupExportConfirmationCoordinator,
  retryStartupExportConfirmation,
} from "./startup-export-confirmation-coordinator";

describe("启动导出确认协调器", () => {
  it("两个并发启动检查只能打开一次确认流程", async () => {
    let flowCount = 0;
    let finishFlow: (() => void) | undefined;
    const coordinator = createStartupExportConfirmationCoordinator({
      runConfirmationFlow() {
        flowCount += 1;
        return new Promise((resolve) => {
          finishFlow = () => resolve({ handledPending: true });
        });
      },
    });

    const first = coordinator.check();
    const second = coordinator.check();

    expect(flowCount).toBe(1);
    finishFlow?.();
    await Promise.all([first, second]);

    const result = await coordinator.check();
    expect(flowCount).toBe(1);
    expect(result.handledPending).toBe(true);
  });

  it("前置恢复失败时保持检查并重试，不能误判为没有待确认", async () => {
    let attempts = 0;

    const result = await retryStartupExportConfirmation({
      async attempt() {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("recovery failed");
        }
        return { handledPending: true };
      },
      async waitBeforeRetry() {},
    });

    expect(attempts).toBe(2);
    expect(result.handledPending).toBe(true);
  });

  it("连续失败达到上限后暂停，只有人工确认后才继续尝试", async () => {
    let attempts = 0;
    let manualRetries = 0;
    const waits: number[] = [];

    const result = await retryStartupExportConfirmation({
      async attempt() {
        attempts += 1;
        if (attempts <= 3) throw new Error("persistent storage failure");
        return { handledPending: false };
      },
      async waitBeforeRetry(failedAttemptCount) {
        waits.push(failedAttemptCount);
      },
      async waitForManualRetry() {
        manualRetries += 1;
      },
      maxAutomaticAttempts: 3,
    });

    expect(waits).toEqual([1, 2]);
    expect(manualRetries).toBe(1);
    expect(attempts).toBe(4);
    expect(result.handledPending).toBe(false);
  });

  it("没有人工恢复入口时达到上限会把持久错误交给调用方", async () => {
    await expect(
      retryStartupExportConfirmation({
        async attempt() {
          throw new Error("storage unavailable");
        },
        async waitBeforeRetry() {},
        maxAutomaticAttempts: 2,
      }),
    ).rejects.toThrow("storage unavailable");
  });

  it("新的冷启动使用新的协调器并重新检查 pending", async () => {
    let flowCount = 0;
    const createCoordinator = () =>
      createStartupExportConfirmationCoordinator({
        async runConfirmationFlow() {
          flowCount += 1;
          return { handledPending: true };
        },
      });

    await createCoordinator().check();
    await createCoordinator().check();

    expect(flowCount).toBe(2);
  });
});
