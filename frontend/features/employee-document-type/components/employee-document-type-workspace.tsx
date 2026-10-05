"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileType2, PauseCircle } from "lucide-react";

import { KpiCard } from "@/components/common/kpi-card";
import { KpiGrid } from "@/components/common/kpi-grid";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { DocumentStructureReadiness } from "@/features/employee-document/components/document-structure-readiness";
import { useAuth } from "@/providers/auth-provider";

import { EmployeeDocumentTypeToolbar } from "./employee-document-type-toolbar";
import { EmployeeDocumentTypeTable } from "./employee-document-type-table";

import { useEmployeeDocumentTypeSummary } from "../hooks/use-employee-document-type-summary";

import type { EmployeeDocumentType } from "../types/employee-document-type";
import type { EmployeeDocumentTypeSearch } from "../types/employee-document-type-search";
import { useDeleteEmployeeDocumentType } from "../hooks/use-delete-employee-document-type";
import {
  employeeDocumentTypeCreateHref,
  employeeDocumentTypeEditHref,
  EMPLOYEE_DOCUMENT_TYPE_LIST,
} from "../lib/employee-document-type-navigation";

export function EmployeeDocumentTypeWorkspace() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("hr.documents.manage");
  const [search, setSearch] = useState("");

  const { data: summary, isLoading: summaryLoading } =
    useEmployeeDocumentTypeSummary();

  const searchParams: EmployeeDocumentTypeSearch = {
    search: search || undefined,
  };
  const deleteDocumentType = useDeleteEmployeeDocumentType();

  return (
    <WorkspaceShell>
      <DocumentStructureReadiness />

      <KpiGrid columns={3}>
        <KpiCard
          title="Total Document Types"
          value={summaryLoading ? "—" : (summary?.total ?? 0)}
          icon={FileType2}
          helperText="Defined document requirements"
          density="compact"
        />

        <KpiCard
          title="Active"
          value={summaryLoading ? "—" : (summary?.active ?? 0)}
          icon={CheckCircle2}
          helperText="Currently enabled"
          tone="success"
          density="compact"
        />

        <KpiCard
          title="Inactive"
          value={summaryLoading ? "—" : (summary?.inactive ?? 0)}
          icon={PauseCircle}
          helperText="Currently disabled"
          tone="neutral"
          density="compact"
        />
      </KpiGrid>

      <EmployeeDocumentTypeToolbar
        search={search}
        onSearchChange={setSearch}
        onRefresh={() => {
          void Promise.all([
            queryClient.invalidateQueries({
              queryKey: ["employee-document-types"],
            }),
            queryClient.invalidateQueries({
              queryKey: ["employee-document-type-summary"],
            }),
          ]);
        }}
        onAdd={
          canManage
            ? () =>
                router.push(
                  employeeDocumentTypeCreateHref({
                    returnTo: EMPLOYEE_DOCUMENT_TYPE_LIST,
                  }),
                )
            : undefined
        }
      />

      <EmployeeDocumentTypeTable
        searchParams={searchParams}
        onEdit={(documentType: EmployeeDocumentType) => {
          router.push(
            employeeDocumentTypeEditHref(documentType.id, {
              returnTo: EMPLOYEE_DOCUMENT_TYPE_LIST,
            }),
          );
        }}
        onDelete={(documentType) => {
          if (confirm(`Delete ${documentType.documentName}?`)) {
            deleteDocumentType.mutate(documentType.id);
          }
        }}
      />
    </WorkspaceShell>
  );
}
