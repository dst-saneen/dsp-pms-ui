"use client";

import { DataTable } from "@/components/tables/data-table";

import { candidateColumns } from "./candidate-columns";
import type { Candidate } from "../types/candidate";

interface CandidateTableProps {
  data: Candidate[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRowClick?: (candidate: Candidate) => void;
}

export function CandidateTable({
  data,
  isLoading,
  error,
  onRetry,
  onRowClick,
}: CandidateTableProps) {
  return (
    <DataTable
      columns={candidateColumns()}
      data={data}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyTitle="No candidates"
      emptyDescription="Candidates appear when applications are submitted through careers or internal HR entry."
      onRowClick={onRowClick}
      getRowLabel={(candidate) =>
        `Open ${candidate.firstName} ${candidate.lastName}`
      }
    />
  );
}
