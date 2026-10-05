"use client";

import { DataTable } from "@/components/tables/data-table";

import { leavePolicyColumns } from "./leave-policy-columns";
import type { LeavePolicy } from "../types/leave-policy";

interface LeavePolicyTableProps {
  data: LeavePolicy[];
  onEdit?: (item: LeavePolicy) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function LeavePolicyTable({
  data,
  onEdit,
  isLoading,
  error,
  onRetry,
}: LeavePolicyTableProps) {
  return (
    <DataTable
      columns={leavePolicyColumns()}
      data={data}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyTitle="No leave policies"
      emptyDescription="Create a policy for a branch (optionally department/designation)."
      onRowClick={(item) => onEdit?.(item)}
      getRowLabel={(item) =>
        `Open ${item.leaveType?.leaveName ?? "leave policy"}`
      }
    />
  );
}
