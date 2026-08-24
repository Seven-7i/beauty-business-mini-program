import { describe, expect, it } from "vitest";
import type { ApplicationData } from "@/domain/data-schema";
import { useAppointmentCalendar } from "./useAppointmentCalendar";

const emptyData: ApplicationData = {
  schemaVersion: 1,
  settings: { schemaVersion: 1 },
  unlockedModules: ["beauty"],
  backupMetadata: { schemaVersion: 1 },
  inventoryItems: [],
  inventoryMovements: [],
  projects: [],
  customers: [],
  appointments: [],
};

describe("预约月历编排", () => {
  it("默认选择今天，切换月份后选择目标月一日", () => {
    const flow = useAppointmentCalendar(
      { readSnapshot: async () => emptyData },
      () => new Date(2026, 7, 8, 12, 0, 0),
    );

    expect(flow.selectedDateKey.value).toBe("2026-08-08");
    flow.nextMonth();
    expect(flow.calendar.value.monthIndex).toBe(8);
    expect(flow.selectedDateKey.value).toBe("2026-09-01");
    flow.previousMonth();
    expect(flow.selectedDateKey.value).toBe("2026-08-01");
  });

  it("读取失败时保留已有月历并结束加载状态", async () => {
    const flow = useAppointmentCalendar({
      readSnapshot: async () => {
        throw new Error("storage failed");
      },
    });

    await flow.refresh();

    expect(flow.calendar.value.days.length).toBeGreaterThan(27);
    expect(flow.errorMessage.value).toContain("读取失败");
    expect(flow.loading.value).toBe(false);
  });
});
