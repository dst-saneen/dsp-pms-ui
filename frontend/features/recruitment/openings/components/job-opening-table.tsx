"use client";

import { DataTable } from "@/components/tables/data-table";

import { jobOpeningColumns } from "./job-opening-columns";
import type { JobOpening } from "../types/job-opening";

interface JobOpeningTableProps {
  data: JobOpening[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRowClick?: (opening: JobOpening) => void;
}

export function JobOpeningTable({
  data,
  isLoading,
  error,
  onRetry,
  onRowClick,
}: JobOpeningTableProps) {
  return (
    <DataTable
      columns={jobOpeningColumns()}
      data={data}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyTitle="No job openings"
      emptyDescription="Create a draft opening with headcount, hiring manager, and evaluation criteria."
      onRowClick={onRowClick}
      getRowLabel={(opening) => `Open ${opening.title}`}
    />
  );
}
