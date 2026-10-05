"use client";

import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { AuthzState } from "@/components/common/authz-state";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployeeDocumentCategoryEditor } from "@/features/employee-document-category/components/employee-document-category-editor";
import { useEmployeeDocumentCategory } from "@/features/employee-document-category/hooks/use-employee-document-category";
import {
  EMPLOYEE_DOCUMENT_CATEGORY_LIST,
  resolveEmployeeDocumentCategoryReturnPath,
} from "@/features/employee-document-category/lib/employee-document-category-navigation";
import { useAuth } from "@/providers/auth-provider";

function EmployeeDocumentCategoryEditContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const { hasPermission } = useAuth();
  const canManage = hasPermission("hr.documents.manage");
  const canRead = hasPermission("hr.documents.read") || canManage;
  const returnTo = resolveEmployeeDocumentCategoryReturnPath(
    searchParams.get("return"),
    EMPLOYEE_DOCUMENT_CATEGORY_LIST,
  );
  const { data: category, isLoading, isError } = useEmployeeDocumentCategory(id);

  if (!canRead) {
    return (
      <PageContainer>
        <AuthzState
          variant="unauthorized"
          title="Cannot view this category"
          description="You need hr.documents.read to open document category details."
          actionLabel="Back to categories"
          onAction={() => router.push(EMPLOYEE_DOCUMENT_CATEGORY_LIST)}
        />
      </PageContainer>
    );
  }

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader
          title="Edit Document Category"
          description="Loading category…"
        />
        <Skeleton className="h-64 rounded-xl" />
      </PageContainer>
    );
  }

  if (isError || !category) {
    return (
      <PageContainer>
        <AuthzState
          variant="not-found"
          title="Document category not found"
          description="This category may have been deleted or is outside your organization scope."
          actionLabel="Back to categories"
          onAction={() => router.push(EMPLOYEE_DOCUMENT_CATEGORY_LIST)}
        />
      </PageContainer>
    );
  }

  if (!canManage) {
    return (
      <PageContainer>
        <AuthzState
          variant="unauthorized"
          title="Cannot edit document categories"
          description="You can view the list, but hr.documents.manage is required to edit."
          actionLabel="Back to categories"
          onAction={() => router.push(EMPLOYEE_DOCUMENT_CATEGORY_LIST)}
        />
      </PageContainer>
    );
  }

  return (
    <EmployeeDocumentCategoryEditor
      mode="edit"
      category={category}
      returnTo={returnTo}
      canManage={canManage}
    />
  );
}

export default function EmployeeDocumentCategoryEditPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
        </PageContainer>
      }
    >
      <EmployeeDocumentCategoryEditContent />
    </Suspense>
  );
}
