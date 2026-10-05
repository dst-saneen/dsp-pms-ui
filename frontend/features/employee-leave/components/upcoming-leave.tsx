import { format } from "date-fns";

import { InfoCard } from "@/components/common";

import type { EmployeeUpcomingLeave } from "../types";

interface UpcomingLeaveProps {
  upcoming: EmployeeUpcomingLeave[];
}

export function UpcomingLeave({
  upcoming,
}: UpcomingLeaveProps) {
  return (
    <InfoCard title="Upcoming Leave">
      {upcoming.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No upcoming leave scheduled.
        </div>
      ) : (
        <div className="space-y-4">
          {upcoming.map((leave) => (
            <div
              key={leave.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div>
                <p className="font-medium">
                  {leave.leaveType}
                </p>

                <p className="text-sm text-muted-foreground">
                  {format(
                    new Date(leave.fromDate),
                    "dd MMM yyyy",
                  )}{" "}
                  -{" "}
                  {format(
                    new Date(leave.toDate),
                    "dd MMM yyyy",
                  )}
                </p>
              </div>

              <div className="text-right">
                <p className="font-semibold">
                  {leave.approvedDays} Day
                  {leave.approvedDays > 1
                    ? "s"
                    : ""}
                </p>

                <p className="text-sm text-muted-foreground">
                  {leave.status}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </InfoCard>
  );
}