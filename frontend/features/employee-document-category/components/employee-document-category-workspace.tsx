"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { WorkspaceShell } from "@/components/common/workspace-shell";
import { DocumentStructureReadiness } from "@/features/employee-document/components/document-structure-readiness";
import { useAuth } from "@/providers/auth-provider";

import { EmployeeDocumentCategoryToolbar } from "./employee-document-category-toolbar";
import { EmployeeDocumentCategoryTable } from "./employee-document-category-table";

import type { EmployeeDocumentCategory } from "../types/employee-document-category";
import { useDeleteEmployeeDocumentCategory } from "../hooks/use-delete-employee-document-category";
import type { EmployeeDocumentCategorySearch } from "../types/employee-document-category-search";
import {
  employeeDocumentCategoryCreateHref,
  employeeDocumentCategoryEditHref,
  EMPLOYEE_DOCUMENT_CATEGORY_LIST,
} from "../lib/employee-document-category-navigation";

export function EmployeeDocumentCategoryWorkspace() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("hr.documents.manage");
  const [search, setSearch] = useState("");

  const deleteCategory = useDeleteEmployeeDocumentCategory();

  const searchParams: EmployeeDocumentCategorySearch = {
    search: search || undefined,
  };

  return (
    <WorkspaceShell>
      <DocumentStructureReadiness />

      <EmployeeDocumentCategoryToolbar
        search={search}
        onSearchChange={setSearch}
        onRefresh={() => {
          void queryClient.invalidateQueries({
            queryKey: ["employee-document-categories"],
          });
        }}
        onAdd={
          canManage
            ? () =>
                router.push(
                  employeeDocumentCategoryCreateHref({
                    returnTo: EMPLOYEE_DOCUMENT_CATEGORY_LIST,
                  }),
                )
            : undefined
        }
      />

      <EmployeeDocumentCategoryTable
        searchParams={searchParams}
        onEdit={(category: EmployeeDocumentCategory) => {
          router.push(
            employeeDocumentCategoryEditHref(category.id, {
              returnTo: EMPLOYEE_DOCUMENT_CATEGORY_LIST,
            }),
          );
        }}
        onDelete={(category) => {
          if (confirm(`Delete "${category.categoryName}"?`)) {
            deleteCategory.mutate(category.id);
          }
        }}
      />
    </WorkspaceShell>
  );
}
