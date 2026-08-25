import { describe, expect, it } from "vitest";
import type { PendingAppointmentV1 } from "@/domain/data-schema";
import { deriveCustomerAppointmentHistory } from "./customer-appointment-history";

function createPendingAppointment(
  id: string,
  customerId: string,
  scheduledAt: string,
): PendingAppointmentV1 {
  return {
    id,
    customerId,
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
    createdAt: scheduledAt,
    updatedAt: scheduledAt,
    schemaVersion: 1,
  };
}

describe("deriveCustomerAppointmentHistory", () => {
  it("只返回当前顾客的预约并按计划时间倒序，不修改源数组", () => {
    const appointments = [
      createPendingAppointment("other", "customer-2", "2026-08-26T08:00:00.000Z"),
      createPendingAppointment("older", "customer-1", "2026-08-24T08:00:00.000Z"),
      createPendingAppointment("newer", "customer-1", "2026-08-25T08:00:00.000Z"),
    ];
    const originalOrder = appointments.map(({ id }) => id);

    expect(
      deriveCustomerAppointmentHistory("customer-1", appointments).map(
        ({ id }) => id,
      ),
    ).toEqual(["newer", "older"]);
    expect(appointments.map(({ id }) => id)).toEqual(originalOrder);
  });
});
