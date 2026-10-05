"use client";

import { DataTable } from "@/components/tables/data-table";

import { leaveTypeColumns } from "./leave-type-columns";
import type { LeaveType } from "../types/leave-type";

interface LeaveTypeTableProps {
  data: LeaveType[];
  companySelected?: boolean;
  companyName?: string | null;
  onEdit?: (item: LeaveType) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function LeaveTypeTable({
  data,
  companySelected = true,
  companyName,
  onEdit,
  isLoading,
  error,
  onRetry,
}: LeaveTypeTableProps) {
  return (
    <DataTable
      columns={leaveTypeColumns({ showCompany: false })}
      data={data}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyTitle={
        companySelected ? "No leave types for this company" : "Select a company"
      }
      emptyDescription={
        companySelected
          ? `Create leave types for ${companyName ?? "this company"}. Other companies keep their own list.`
          : "Choose a company to see leave types that belong only to that company."
      }
      onRowClick={(item) => onEdit?.(item)}
      getRowLabel={(item) => `Open ${item.leaveName}`}
    />
  );
}
