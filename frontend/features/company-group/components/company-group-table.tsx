"use client";

import { Building2, Plus, RotateCcw } from "lucide-react";

import { DataTable } from "@/components/tables/data-table";

import { CompanyGroupToolbar } from "./company-group-toolbar";
import { companyGroupColumns } from "./company-group-columns";

import type { CompanyGroup } from "../types/company-group";

interface CompanyGroupTableProps {
  data: CompanyGroup[];
  totalCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  onCreate: (trigger?: HTMLElement) => void;
  onEdit?: (companyGroup: CompanyGroup, trigger?: HTMLElement) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function CompanyGroupTable({
  data,
  totalCount,
  search,
  onSearchChange,
  onCreate,
  onEdit,
  isLoading = false,
  error,
  onRetry,
}: CompanyGroupTableProps) {
  const hasSearch = search.trim().length > 0;

  return (
    <DataTable
      columns={companyGroupColumns()}
      data={data}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      toolbar={
        <CompanyGroupToolbar
          search={search}
          onSearchChange={onSearchChange}
          visibleCount={data.length}
          totalCount={totalCount}
        />
      }
      emptyIcon={Building2}
      emptyTitle={
        hasSearch ? "No matching company groups" : "No company groups yet"
      }
      emptyDescription={
        hasSearch
          ? "Try another search term or clear the current search."
          : "Create the first company group to begin organizing your ERP hierarchy."
      }
      emptyActionLabel={
        hasSearch ? "Clear search" : "Create first company group"
      }
      emptyActionIcon={hasSearch ? RotateCcw : Plus}
      onEmptyAction={
        hasSearch
          ? () => onSearchChange("")
          : (trigger) => onCreate(trigger)
      }
      onRowClick={(companyGroup, trigger) =>
        onEdit?.(companyGroup, trigger)
      }
      getRowLabel={(companyGroup) =>
        `Edit ${companyGroup.groupName} company group`
      }
      ariaLabel="Company groups"
    />
  );
}
