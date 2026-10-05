"use client";

import { DataTable } from "@/components/tables/data-table";

import { shiftColumns } from "./shift-columns";

import type { Shift } from "../types/shift";

interface ShiftTableProps {
  data: Shift[];
  onEdit?: (shift: Shift) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function ShiftTable({ data, onEdit, isLoading, error, onRetry }: ShiftTableProps) {
  return (
    <DataTable
      columns={shiftColumns()}
      data={data}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyTitle="No shifts found"
      emptyDescription="Select a company, create a shift or adjust the filters."
      onRowClick={(shift) => onEdit?.(shift)}
      getRowLabel={(shift) => `Open ${shift.shiftName}`}
    />
  );
}
