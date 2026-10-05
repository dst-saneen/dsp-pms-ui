"use client";

import { DataTable } from "@/components/tables/data-table";
import { getApiErrorMessage } from "@/services/api-client";

import { useEmployeeDocumentCategories } from "../hooks/use-employee-document-categories";

import { employeeDocumentCategoryColumns } from "./employee-document-category-columns";

import type { EmployeeDocumentCategory } from "../types/employee-document-category";
import type { EmployeeDocumentCategorySearch } from "../types/employee-document-category-search";

interface EmployeeDocumentCategoryTableProps {
  onEdit?: (category: EmployeeDocumentCategory) => void;

  onDelete?: (category: EmployeeDocumentCategory) => void;

  searchParams?: EmployeeDocumentCategorySearch;
}

export function EmployeeDocumentCategoryTable({
  onEdit,
  onDelete,
  searchParams,
}: EmployeeDocumentCategoryTableProps) {
  const {
    data: categories = [],
    isLoading,
    error,
    refetch,
  } = useEmployeeDocumentCategories(searchParams);

  return (
    <DataTable
      columns={employeeDocumentCategoryColumns(onDelete)}
      data={categories}
      isLoading={isLoading}
      error={error ? getApiErrorMessage(error, "We could not load document categories.") : null}
      onRetry={() => {
        void refetch();
      }}
      emptyTitle="No document categories"
      emptyDescription="Create a category to organize employee documents."
      onRowClick={(category: EmployeeDocumentCategory) => onEdit?.(category)}
      getRowLabel={(category) => `Open ${category.categoryName}`}
    />
  );
}
