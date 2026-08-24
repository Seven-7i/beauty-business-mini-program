import { afterEach, describe, expect, it, vi } from "vitest";
import { useStorageCapacityReminder } from "./useStorageCapacityReminder";
import type { StorageCapacitySummary } from "@/services/storage-capacity-service";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("产品级容量提醒", () => {
  function summary(
    status: StorageCapacitySummary["status"],
  ): StorageCapacitySummary {
    return {
      currentSizeKb: status === "target-reached" ? 7168 : 128,
      limitSizeKb: 10240,
      targetSizeKb: 7168,
      keyCount: 1,
      usedPercentOfLimit: status === "target-reached" ? 70 : 1.25,
      usedPercentOfTarget: status === "target-reached" ? 100 : 128 / 7168 * 100,
      remainingToTargetKb: status === "target-reached" ? 0 : 7040,
      status,
    };
  }

  it("低于目标线不提醒", async () => {
    const showModal = vi.fn();
    vi.stubGlobal("uni", { showModal });
    const reminder = useStorageCapacityReminder({
      service: {
        async readSummary() {
          return summary("within-target");
        },
      },
      openBackupRestore: vi.fn(),
      openHistoryCleanup: vi.fn(),
    });

    await expect(reminder.checkStorageCapacity()).resolves.toBe(false);
    expect(showModal).not.toHaveBeenCalled();
  });

  it("达到目标线后只提示一次，并把两个选择交给正式功能入口", async () => {
    const openBackupRestore = vi.fn();
    const openHistoryCleanup = vi.fn();
    const showModal = vi.fn((options: { success: (result: { confirm: boolean; cancel: boolean }) => void }) => {
      options.success({ confirm: false, cancel: true });
    });
    vi.stubGlobal("uni", { showModal });
    const reminder = useStorageCapacityReminder({
      service: {
        async readSummary() {
          return summary("target-reached");
        },
      },
      openBackupRestore,
      openHistoryCleanup,
    });

    await expect(reminder.checkStorageCapacity()).resolves.toBe(true);
    await expect(reminder.checkStorageCapacity()).resolves.toBe(true);
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(openHistoryCleanup).toHaveBeenCalledTimes(1);
    expect(openBackupRestore).not.toHaveBeenCalled();
  });

  it("并发检查共用同一个待选择弹窗，并持续压住低优先级提醒", async () => {
    let finishModal: (() => void) | undefined;
    const showModal = vi.fn(
      (options: {
        success: (result: { confirm: boolean; cancel: boolean }) => void;
      }) => {
        finishModal = () => options.success({ confirm: true, cancel: false });
      },
    );
    const openBackupRestore = vi.fn();
    vi.stubGlobal("uni", { showModal });
    const reminder = useStorageCapacityReminder({
      service: { async readSummary() { return summary("target-reached"); } },
      openBackupRestore,
      openHistoryCleanup: vi.fn(),
    });

    const first = reminder.checkStorageCapacity();
    const second = reminder.checkStorageCapacity();
    await Promise.resolve();

    expect(showModal).toHaveBeenCalledTimes(1);
    let settled = false;
    void first.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);

    finishModal?.();
    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(openBackupRestore).toHaveBeenCalledTimes(1);
  });
});
