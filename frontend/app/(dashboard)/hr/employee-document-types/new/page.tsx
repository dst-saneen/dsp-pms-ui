"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { PageContainer } from "@/components/common/page-container";
import { PermissionGate } from "@/components/common/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployeeDocumentTypeEditor } from "@/features/employee-document-type/components/employee-document-type-editor";
import { resolveEmployeeDocumentTypeReturnPath } from "@/features/employee-document-type/lib/employee-document-type-navigation";
import { useAuth } from "@/providers/auth-provider";

function EmployeeDocumentTypeCreateContent() {
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const returnTo = resolveEmployeeDocumentTypeReturnPath(
    searchParams.get("return"),
  );
  const canManage = hasPermission("hr.documents.manage");

  return (
    <PermissionGate
      permission="hr.documents.manage"
      fallback="unauthorized"
      unauthorizedTitle="Cannot create document types"
      unauthorizedDescription="You need hr.documents.manage to create a document type."
    >
      <EmployeeDocumentTypeEditor
        mode="create"
        returnTo={returnTo}
        canManage={canManage}
      />
    </PermissionGate>
  );
}

export default function EmployeeDocumentTypeCreatePage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
        </PageContainer>
      }
    >
      <EmployeeDocumentTypeCreateContent />
    </Suspense>
  );
}
