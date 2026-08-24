import { describe, expect, it } from "vitest";
import type {
  AppointmentV1,
  CompletedAppointmentV1,
  PendingAppointmentV1,
} from "@/domain/data-schema";
import {
  deriveBeautyHomeOverview,
  deriveCustomerBusinessSummary,
} from "./statistics-service";

function localIso(dayOffset: number, hour: number): string {
  const base = new Date(2026, 7, 8 + dayOffset, hour, 0, 0, 0);
  return base.toISOString();
}

function pending(id: string, scheduledAt: string): PendingAppointmentV1 {
  return {
    id,
    customerId: "customer-1",
    projectSnapshots: [
      {
        projectId: "project-1",
        name: "补水护理",
        standardPriceCents: 8800,
        durationMinutes: 60,
      },
    ],
    standardAmountCents: 8800,
    estimatedDurationMinutes: 60,
    actualUsages: [],
    scheduledAt,
    serviceAddressSnapshot: { addressText: "测试地址" },
    status: "pending",
    createdAt: localIso(-10, 10),
    updatedAt: localIso(-10, 10),
    schemaVersion: 1,
  };
}

function completed(
  id: string,
  completedAt: string,
  amount: number,
  customerId = "customer-1",
): CompletedAppointmentV1 {
  return {
    ...pending(id, localIso(-2, 10)),
    customerId,
    status: "completed",
    actualUsages: [],
    transactionAmountCents: amount,
    completedAt,
  };
}

describe("轻量经营统计与预约提醒", () => {
  it("提醒只包含全部逾期、今天和明天起三个本地自然日", () => {
    const now = new Date(2026, 7, 8, 12, 0, 0, 0);
    const appointments: AppointmentV1[] = [
      pending("overdue-old", localIso(-20, 9)),
      pending("overdue-today", localIso(0, 10)),
      pending("today", localIso(0, 14)),
      pending("day-1", localIso(1, 9)),
      pending("day-3", localIso(3, 18)),
      pending("day-4", localIso(4, 9)),
      { ...pending("cancelled", localIso(1, 10)), status: "cancelled", cancelledAt: localIso(0, 8) },
    ];

    const overview = deriveBeautyHomeOverview(appointments, now);

    expect(overview.pendingCount).toBe(6);
    expect(overview.reminders.map(({ appointment, group }) => [appointment.id, group])).toEqual([
      ["overdue-old", "overdue"],
      ["overdue-today", "overdue"],
      ["today", "today"],
      ["day-1", "next-three-days"],
      ["day-3", "next-three-days"],
    ]);
  });

  it("本月经营统计按实际完成时间归属，不使用计划时间", () => {
    const now = new Date(2026, 7, 8, 12, 0, 0, 0);
    const overview = deriveBeautyHomeOverview(
      [
        completed("last-month", localIso(-9, 23), 5000),
        completed("this-month-1", localIso(-7, 0), 8250),
        completed("this-month-2", localIso(0, 11), 9000),
      ],
      now,
    );

    expect(overview.monthlyCompletedCount).toBe(2);
    expect(overview.monthlyTransactionAmountCents).toBe(17250);
  });

  it("顾客累计只汇总该顾客仍存在的已完成预约", () => {
    const appointments: AppointmentV1[] = [
      completed("one", localIso(0, 10), 8250),
      completed("two", localIso(0, 11), 9000),
      completed("other", localIso(0, 12), 12000, "customer-2"),
      pending("pending", localIso(1, 10)),
    ];

    expect(deriveCustomerBusinessSummary("customer-1", appointments)).toEqual({
      completedCount: 2,
      transactionAmountCents: 17250,
    });
  });
});
