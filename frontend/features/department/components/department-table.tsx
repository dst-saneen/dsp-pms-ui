"use client";

import { DataTable } from "@/components/tables/data-table";

import { departmentColumns } from "./department-columns";

import type { Department } from "../types/department";

interface DepartmentTableProps {
  data: Department[];
  onEdit?: (department: Department) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function DepartmentTable({ data, onEdit, isLoading, error, onRetry }: DepartmentTableProps) {
  return (
    <DataTable
      columns={departmentColumns()}
      data={data}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyTitle="No departments found"
      emptyDescription="Select a branch, create a department or adjust the search."
      onRowClick={(department) => onEdit?.(department)}
      getRowLabel={(department) => `Open ${department.departmentName}`}
    />
  );
}
