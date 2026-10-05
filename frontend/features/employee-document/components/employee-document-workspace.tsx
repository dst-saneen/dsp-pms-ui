"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { FileCheck2, FileClock, FileWarning, Files } from "lucide-react";

import { KpiCard } from "@/components/common/kpi-card";
import { KpiGrid } from "@/components/common/kpi-grid";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { Badge } from "@/components/ui/badge";
import { DocumentStructureReadiness } from "@/features/employee-document/components/document-structure-readiness";
import { useAuth } from "@/providers/auth-provider";

import { EmployeeDocumentToolbar } from "./employee-document-toolbar";
import { EmployeeDocumentTable } from "./employee-document-table";

import { useEmployeeDocumentSummary } from "../hooks/use-employee-document-summary";

import type { EmployeeDocument } from "../types/employee-document";
import type { EmployeeDocumentSearch } from "../types/employee-document-search";
import {
  employeeDocumentCreateHref,
  employeeDocumentDetailHref,
  EMPLOYEE_DOCUMENT_LIST,
} from "../lib/employee-document-navigation";

export function EmployeeDocumentWorkspace() {
  const router = useRouter();
  const urlSearchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("hr.documents.manage");
  const [search, setSearch] = useState("");

  const employeeIdFilter =
    urlSearchParams.get("employeeId")?.trim() || undefined;

  const { data: summary, isLoading: summaryLoading } =
    useEmployeeDocumentSummary();

  const searchParams: EmployeeDocumentSearch = useMemo(
    () => ({
      search: search || undefined,
      employeeId: employeeIdFilter,
    }),
    [employeeIdFilter, search],
  );

  return (
    <WorkspaceShell>
      <DocumentStructureReadiness />

      <KpiGrid columns={4}>
        <KpiCard
          title="Total Documents"
          value={summaryLoading ? "—" : (summary?.total ?? 0)}
          icon={Files}
          helperText="Employee document records"
          density="compact"
        />

        <KpiCard
          title="Verified"
          value={summaryLoading ? "—" : (summary?.verified ?? 0)}
          icon={FileCheck2}
          helperText="Completed verification"
          tone="success"
          density="compact"
        />

        <KpiCard
          title="Pending"
          value={summaryLoading ? "—" : (summary?.pending ?? 0)}
          icon={FileClock}
          helperText="Awaiting verification"
          tone="warning"
          density="compact"
        />

        <KpiCard
          title="Expired"
          value={summaryLoading ? "—" : (summary?.expired ?? 0)}
          icon={FileWarning}
          helperText="Past expiry date"
          tone="neutral"
          density="compact"
        />
      </KpiGrid>

      {employeeIdFilter ? (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Filtered by employee</Badge>

          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => router.push(EMPLOYEE_DOCUMENT_LIST)}
          >
            Clear filter
          </button>
        </div>
      ) : null}

      <EmployeeDocumentToolbar
        search={search}
        onSearchChange={setSearch}
        onRefresh={() => {
          void Promise.all([
            queryClient.invalidateQueries({
              queryKey: ["employee-documents"],
            }),
            queryClient.invalidateQueries({
              queryKey: ["employee-document-summary"],
            }),
          ]);
        }}
        onAdd={
          canManage
            ? () =>
                router.push(
                  employeeDocumentCreateHref({
                    returnTo: EMPLOYEE_DOCUMENT_LIST,
                    employeeId: employeeIdFilter,
                  }),
                )
            : undefined
        }
      />

      <EmployeeDocumentTable
        searchParams={searchParams}
        onOpen={(document: EmployeeDocument) => {
          router.push(
            employeeDocumentDetailHref(document.id, {
              returnTo: EMPLOYEE_DOCUMENT_LIST,
            }),
          );
        }}
      />
    </WorkspaceShell>
  );
}
