"use client";

import { DataTable } from "@/components/tables/data-table";

import { branchColumns } from "./branch-columns";

import type { Branch } from "../types/branch";

interface BranchTableProps {
  data: Branch[];
  onEdit?: (branch: Branch) => void;
  onConfigureCalendar?: (branch: Branch) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function BranchTable({
  data,
  onEdit,
  onConfigureCalendar,
  isLoading,
  error,
  onRetry,
}: BranchTableProps) {
  return (
    <DataTable
      columns={branchColumns(onConfigureCalendar)}
      data={data}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyTitle="No branches found"
      emptyDescription="Create a branch or adjust the current search."
      onRowClick={(branch) => onEdit?.(branch)}
      getRowLabel={(branch) => `Open ${branch.branchName}`}
    />
  );
}
