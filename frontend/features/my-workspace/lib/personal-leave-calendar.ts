import type { MyCalendarDay, MyLeaveBalance } from "../types";

export type PersonalCalendarSelfDay = MyCalendarDay["employees"][number];

export function monthDateKeys(year: number, monthIndex: number): string[] {
  const count = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, monthIndex, index + 1));
    return date.toISOString().slice(0, 10);
  });
}

export function formatCalendarDate(dateKey: string, style: "long" | "medium" = "long") {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: style === "long" ? "long" : "short",
    day: "numeric",
    month: style === "long" ? "long" : "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function selfDayForDate(
  days: MyCalendarDay[],
  dateKey: string,
): PersonalCalendarSelfDay | undefined {
  const match = days.find((day) => day.date.slice(0, 10) === dateKey);
  return match?.employees[0];
}

export function matchingLeaveBalance(
  day: Pick<PersonalCalendarSelfDay, "leaveTypeId" | "leaveTypeName"> | undefined,
  balances: MyLeaveBalance[],
): MyLeaveBalance | null {
  if (!day) return null;
  if (day.leaveTypeId) {
    const byId = balances.find((row) => row.leaveTypeId === day.leaveTypeId);
    if (byId) return byId;
  }
  const name = day.leaveTypeName?.trim().toLowerCase();
  if (!name) return null;
  return (
    balances.find((row) => row.leaveName.trim().toLowerCase() === name) ?? null
  );
}

export function friendlyLeaveStatus(status: string | null | undefined): string | null {
  if (!status) return null;
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "SUBMITTED":
    case "PENDING":
      return "Pending approval";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status.replaceAll("_", " ");
  }
}
