"use client";

import { DataTable } from "@/components/tables/data-table";

import { companyColumns } from "./company-columns";

import type { Company } from "../types/company";

interface CompanyTableProps {
  data: Company[];
  onEdit?: (company: Company) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function CompanyTable({ data, onEdit, isLoading, error, onRetry }: CompanyTableProps) {
  return (
    <DataTable
      columns={companyColumns()}
      data={data}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyTitle="No companies found"
      emptyDescription="Create a company or adjust the current search."
      onRowClick={(company) => onEdit?.(company)}
      getRowLabel={(company) => `Open ${company.companyName}`}
    />
  );
}
