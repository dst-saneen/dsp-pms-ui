"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { PageContainer } from "@/components/common/page-container";
import { PermissionGate } from "@/components/common/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployeeDocumentEditor } from "@/features/employee-document/components/employee-document-editor";
import { resolveEmployeeDocumentReturnPath } from "@/features/employee-document/lib/employee-document-navigation";
import { useAuth } from "@/providers/auth-provider";

function EmployeeDocumentCreateContent() {
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const returnTo = resolveEmployeeDocumentReturnPath(searchParams.get("return"));
  const defaultEmployeeId =
    searchParams.get("employeeId")?.trim() || undefined;
  const canManage = hasPermission("hr.documents.manage");

  return (
    <PermissionGate
      permission="hr.documents.manage"
      fallback="unauthorized"
      unauthorizedTitle="Cannot create employee documents"
      unauthorizedDescription="You need hr.documents.manage to create an employee document."
    >
      <EmployeeDocumentEditor
        mode="create"
        defaultEmployeeId={defaultEmployeeId}
        returnTo={returnTo}
        canManage={canManage}
      />
    </PermissionGate>
  );
}

export default function EmployeeDocumentCreatePage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
        </PageContainer>
      }
    >
      <EmployeeDocumentCreateContent />
    </Suspense>
  );
}
