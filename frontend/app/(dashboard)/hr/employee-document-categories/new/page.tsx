"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { PageContainer } from "@/components/common/page-container";
import { PermissionGate } from "@/components/common/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployeeDocumentCategoryEditor } from "@/features/employee-document-category/components/employee-document-category-editor";
import { resolveEmployeeDocumentCategoryReturnPath } from "@/features/employee-document-category/lib/employee-document-category-navigation";
import { useAuth } from "@/providers/auth-provider";

function EmployeeDocumentCategoryCreateContent() {
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const returnTo = resolveEmployeeDocumentCategoryReturnPath(
    searchParams.get("return"),
  );
  const canManage = hasPermission("hr.documents.manage");

  return (
    <PermissionGate
      permission="hr.documents.manage"
      fallback="unauthorized"
      unauthorizedTitle="Cannot create document categories"
      unauthorizedDescription="You need hr.documents.manage to create a document category."
    >
      <EmployeeDocumentCategoryEditor
        mode="create"
        returnTo={returnTo}
        canManage={canManage}
      />
    </PermissionGate>
  );
}

export default function EmployeeDocumentCategoryCreatePage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
        </PageContainer>
      }
    >
      <EmployeeDocumentCategoryCreateContent />
    </Suspense>
  );
}
