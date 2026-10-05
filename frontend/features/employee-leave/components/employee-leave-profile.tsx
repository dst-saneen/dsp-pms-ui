"use client";

import { useEmployeeLeave } from "../hooks";

import { LeaveSummary } from "./leave-summary";
import { LeaveBalanceList } from "./leave-balance-list";
import { UpcomingLeave } from "./upcoming-leave";
import { LeaveHistory } from "./leave-history";

import { ErrorState } from "@/components/common";
import { Loader2 } from "lucide-react";

interface EmployeeLeaveProfileProps {
  employeeId: string;
  year?: number;
}

export function EmployeeLeaveProfile({
  employeeId,
  year,
}: EmployeeLeaveProfileProps) {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useEmployeeLeave(employeeId, year);

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        title="Unable to load leave information"
        description="An unexpected error occurred while loading employee leave details."
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="space-y-6">
      <LeaveSummary summary={data.summary} />

      <LeaveBalanceList
        balances={data.balances}
      />

      <UpcomingLeave
        upcoming={data.upcoming}
      />

      <LeaveHistory
        history={data.history}
      />
    </div>
  );
}