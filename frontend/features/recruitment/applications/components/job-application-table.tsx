"use client";

import { DataTable } from "@/components/tables/data-table";

import { jobApplicationColumns } from "./job-application-columns";
import type { JobApplication } from "../types/job-application";

interface JobApplicationTableProps {
  data: JobApplication[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRowClick?: (application: JobApplication) => void;
}

export function JobApplicationTable({
  data,
  isLoading,
  error,
  onRetry,
  onRowClick,
}: JobApplicationTableProps) {
  return (
    <DataTable
      columns={jobApplicationColumns()}
      data={data}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyTitle="No applications"
      emptyDescription="Create an internal application or wait for candidates to apply through careers."
      onRowClick={onRowClick}
      getRowLabel={(application) =>
        `Open application ${application.applicationNumber}`
      }
    />
  );
}
