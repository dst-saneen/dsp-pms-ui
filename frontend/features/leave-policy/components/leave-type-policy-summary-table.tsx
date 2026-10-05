"use client";

import { DataTable } from "@/components/tables/data-table";

import { leaveTypePolicySummaryColumns } from "./leave-type-policy-summary-columns";
import type { LeaveTypePolicySummary } from "../lib/leave-policy-leave-type-summary";

interface LeaveTypePolicySummaryTableProps {
  data: LeaveTypePolicySummary[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  canManage?: boolean;
  savingRowId?: string | null;
  onSaveCarryForward?: (row: LeaveTypePolicySummary, value: number) => void;
}

export function LeaveTypePolicySummaryTable({
  data,
  isLoading,
  error,
  onRetry,
  canManage = false,
  savingRowId = null,
  onSaveCarryForward,
}: LeaveTypePolicySummaryTableProps) {
  return (
    <DataTable
      columns={leaveTypePolicySummaryColumns({
        canManage,
        savingRowId,
        onSaveCarryForward: (row, value) => onSaveCarryForward?.(row, value),
      })}
      data={data}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyTitle="No leave types configured"
      emptyDescription="Set days per year in the designation matrix first."
      getRowLabel={(item) =>
        `${item.leaveTypeName} for ${item.branchName}`
      }
    />
  );
}
