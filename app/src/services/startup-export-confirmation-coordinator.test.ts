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
