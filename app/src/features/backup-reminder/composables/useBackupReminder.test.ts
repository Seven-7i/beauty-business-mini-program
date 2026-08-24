import { afterEach, describe, expect, it, vi } from "vitest";
import { useBackupReminder } from "./useBackupReminder";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("首页备份提醒", () => {
  it("同一本地自然日只检查一次，跨夜从后台返回后重新检查", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 8, 16, 20));
    vi.stubGlobal("uni", { showModal: vi.fn() });
    let claimCount = 0;
    const service = {
      async claimDueReminder() {
        claimCount += 1;
        return false;
      },
    };
    const { checkBackupReminder } = useBackupReminder({
      service,
      openBackupRestore: vi.fn(),
    });

    await checkBackupReminder();
    await checkBackupReminder();
    expect(claimCount).toBe(1);

    vi.setSystemTime(new Date(2026, 7, 9, 0, 1));
    await checkBackupReminder();
    expect(claimCount).toBe(2);
  });
});
