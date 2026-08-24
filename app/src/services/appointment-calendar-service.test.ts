import { describe, expect, it } from "vitest";
import type { AppointmentV1, PendingAppointmentV1 } from "@/domain/data-schema";
import { buildAppointmentMonthCalendar } from "./appointment-calendar-service";

function appointment(id: string, scheduledAt: Date): PendingAppointmentV1 {
  const iso = scheduledAt.toISOString();
  return {
    id,
    customerId: "customer-1",
    projectSnapshots: [{ projectId: "project-1", name: "护理", standardPriceCents: 1000, durationMinutes: 60 }],
    standardAmountCents: 1000,
    estimatedDurationMinutes: 60,
    actualUsages: [],
    scheduledAt: iso,
    serviceAddressSnapshot: { addressText: "测试地址" },
    status: "pending",
    createdAt: iso,
    updatedAt: iso,
    schemaVersion: 1,
  };
}

describe("预约月历", () => {
  it("按本地计划日期分组、补齐月首位置并按时间排序", () => {
    const later = appointment("later", new Date(2026, 7, 8, 18, 0));
    const earlier = appointment("earlier", new Date(2026, 7, 8, 9, 0));
    const cancelled: AppointmentV1 = {
      ...appointment("cancelled", new Date(2026, 7, 9, 10, 0)),
      status: "cancelled",
      cancelledAt: new Date(2026, 7, 7, 10, 0).toISOString(),
    };

    const calendar = buildAppointmentMonthCalendar(2026, 7, [later, cancelled, earlier]);

    expect(calendar.leadingBlankCount).toBe(new Date(2026, 7, 1).getDay());
    expect(calendar.days).toHaveLength(31);
    expect(calendar.days[7]?.appointments.map(({ id }) => id)).toEqual(["earlier", "later"]);
    expect(calendar.days[8]?.appointments[0]?.status).toBe("cancelled");
  });

  it("闰年二月生成 29 天并排除其他月份", () => {
    const calendar = buildAppointmentMonthCalendar(2028, 1, [
      appointment("feb", new Date(2028, 1, 29, 10, 0)),
      appointment("march", new Date(2028, 2, 1, 10, 0)),
    ]);

    expect(calendar.days).toHaveLength(29);
    expect(calendar.days[28]?.appointments.map(({ id }) => id)).toEqual(["feb"]);
  });

  it("拒绝无效月份而不自动归一化到其他年份", () => {
    expect(() => buildAppointmentMonthCalendar(2026, 12, [])).toThrow("年月无效");
  });
});
