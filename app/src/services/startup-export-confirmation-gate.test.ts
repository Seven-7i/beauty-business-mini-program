import { describe, expect, it } from "vitest";
import {
  setStartupExportConfirmationGate,
  waitForStartupExportConfirmation,
} from "./startup-export-confirmation-gate";

describe("启动待确认门禁", () => {
  it("在全局确认流程完成前不放行页面级保护提醒", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<{ handledPending: boolean }>((resolve) => {
      release = () => resolve({ handledPending: true });
    });
    setStartupExportConfirmationGate(gate);
    let continued = false;
    let handledPending = false;
    const waiting = waitForStartupExportConfirmation().then((result) => {
      handledPending = result.handledPending;
      continued = true;
    });

    await Promise.resolve();
    expect(continued).toBe(false);
    release?.();
    await waiting;
    expect(continued).toBe(true);
    expect(handledPending).toBe(true);

    await expect(waitForStartupExportConfirmation()).resolves.toEqual({
      handledPending: false,
    });
  });
});
