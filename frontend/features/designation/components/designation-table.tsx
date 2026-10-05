"use client";

import { DataTable } from "@/components/tables/data-table";

import { designationColumns } from "./designation-columns";

import type { Designation } from "../types/designation";

interface DesignationTableProps {
  data: Designation[];
  onEdit?: (designation: Designation) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function DesignationTable({
  data,
  onEdit,
  isLoading,
  error,
  onRetry,
}: DesignationTableProps) {
  return (
    <DataTable
      columns={designationColumns()}
      data={data}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyTitle="No designations found"
      emptyDescription="Select a company, create a designation or adjust the search."
      onRowClick={(designation) => onEdit?.(designation)}
      getRowLabel={(designation) => `Open ${designation.designationName}`}
    />
  );
}
