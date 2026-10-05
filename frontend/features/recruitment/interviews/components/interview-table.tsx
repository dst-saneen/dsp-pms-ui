"use client";

import { DataTable } from "@/components/tables/data-table";

import { interviewColumns } from "./interview-columns";
import type { InterviewSession } from "../types/interview";

interface InterviewTableProps {
  data: InterviewSession[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRowClick?: (session: InterviewSession) => void;
}

export function InterviewTable({
  data,
  isLoading,
  error,
  onRetry,
  onRowClick,
}: InterviewTableProps) {
  return (
    <DataTable
      columns={interviewColumns()}
      data={data}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyTitle="No interviews scheduled"
      emptyDescription="Schedule interview rounds for applications in Interview status."
      onRowClick={onRowClick}
      getRowLabel={(session) => `Open interview ${session.roundName}`}
    />
  );
}
