"use client";

import { DataTable } from "@/components/tables/data-table";
import { getApiErrorMessage } from "@/services/api-client";

import { useEmployeeDocumentTypes } from "../hooks/use-employee-document-types";
import { employeeDocumentTypeColumns } from "./employee-document-type-columns";

import type { EmployeeDocumentType } from "../types/employee-document-type";
import type { EmployeeDocumentTypeSearch } from "../types/employee-document-type-search";

interface EmployeeDocumentTypeTableProps {
  onEdit?: (documentType: EmployeeDocumentType) => void;

  onDelete?: (documentType: EmployeeDocumentType) => void;

  searchParams?: EmployeeDocumentTypeSearch;
}

export function EmployeeDocumentTypeTable({
  onEdit,
  onDelete,
  searchParams,
}: EmployeeDocumentTypeTableProps) {
  const {
    data: documentTypes = [],
    isLoading,
    error,
    refetch,
  } = useEmployeeDocumentTypes(searchParams);

  return (
    <DataTable
      columns={employeeDocumentTypeColumns(onDelete)}
      data={documentTypes}
      isLoading={isLoading}
      error={error ? getApiErrorMessage(error, "We could not load document types.") : null}
      onRetry={() => {
        void refetch();
      }}
      emptyTitle="No document types"
      emptyDescription="Create a document type to define employee requirements."
      onRowClick={(documentType: EmployeeDocumentType) => onEdit?.(documentType)}
      getRowLabel={(documentType) => `Open ${documentType.documentName}`}
    />
  );
}
