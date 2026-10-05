"use client";

import { DataTable } from "@/components/tables/data-table";
import { getApiErrorMessage } from "@/services/api-client";

import { useEmployeeDocuments } from "../hooks/use-employee-documents";
import { employeeDocumentColumns } from "./employee-document-columns";
import { EMPLOYEE_DOCUMENT_LIST } from "../lib/employee-document-navigation";

import type { EmployeeDocument } from "../types/employee-document";
import type { EmployeeDocumentSearch } from "../types/employee-document-search";

interface EmployeeDocumentTableProps {
  onOpen?: (document: EmployeeDocument) => void;
  /** @deprecated Use onOpen — rows open the detail page. */
  onEdit?: (document: EmployeeDocument) => void;
  searchParams?: EmployeeDocumentSearch;
}

export function EmployeeDocumentTable({
  onOpen,
  onEdit,
  searchParams,
}: EmployeeDocumentTableProps) {
  const { data: documents = [], isLoading, error, refetch } = useEmployeeDocuments(searchParams);
  const handleOpen = onOpen ?? onEdit;

  return (
    <DataTable
      columns={employeeDocumentColumns({
        returnTo: EMPLOYEE_DOCUMENT_LIST,
      })}
      data={documents}
      isLoading={isLoading}
      error={error ? getApiErrorMessage(error, "We could not load employee documents.") : null}
      onRetry={() => {
        void refetch();
      }}
      emptyTitle="No employee documents"
      emptyDescription="Add a document to begin building the employee record."
      onRowClick={(document: EmployeeDocument) => handleOpen?.(document)}
      getRowLabel={(document) => `Open ${document.title}`}
    />
  );
}
