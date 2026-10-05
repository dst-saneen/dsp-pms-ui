"use client";

import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { AuthzState } from "@/components/common/authz-state";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployeeDocumentTypeEditor } from "@/features/employee-document-type/components/employee-document-type-editor";
import { useEmployeeDocumentType } from "@/features/employee-document-type/hooks/use-employee-document-type";
import {
  EMPLOYEE_DOCUMENT_TYPE_LIST,
  resolveEmployeeDocumentTypeReturnPath,
} from "@/features/employee-document-type/lib/employee-document-type-navigation";
import { useAuth } from "@/providers/auth-provider";

function EmployeeDocumentTypeEditContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const { hasPermission } = useAuth();
  const canManage = hasPermission("hr.documents.manage");
  const canRead = hasPermission("hr.documents.read") || canManage;
  const returnTo = resolveEmployeeDocumentTypeReturnPath(
    searchParams.get("return"),
    EMPLOYEE_DOCUMENT_TYPE_LIST,
  );
  const {
    data: documentType,
    isLoading,
    isError,
  } = useEmployeeDocumentType(id);

  if (!canRead) {
    return (
      <PageContainer>
        <AuthzState
          variant="unauthorized"
          title="Cannot view this document type"
          description="You need hr.documents.read to open document type details."
          actionLabel="Back to document types"
          onAction={() => router.push(EMPLOYEE_DOCUMENT_TYPE_LIST)}
        />
      </PageContainer>
    );
  }

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader
          title="Edit Document Type"
          description="Loading document type…"
        />
        <Skeleton className="h-64 rounded-xl" />
      </PageContainer>
    );
  }

  if (isError || !documentType) {
    return (
      <PageContainer>
        <AuthzState
          variant="not-found"
          title="Document type not found"
          description="This document type may have been deleted or is outside your organization scope."
          actionLabel="Back to document types"
          onAction={() => router.push(EMPLOYEE_DOCUMENT_TYPE_LIST)}
        />
      </PageContainer>
    );
  }

  if (!canManage) {
    return (
      <PageContainer>
        <AuthzState
          variant="unauthorized"
          title="Cannot edit document types"
          description="You can view the list, but hr.documents.manage is required to edit."
          actionLabel="Back to document types"
          onAction={() => router.push(EMPLOYEE_DOCUMENT_TYPE_LIST)}
        />
      </PageContainer>
    );
  }

  return (
    <EmployeeDocumentTypeEditor
      mode="edit"
      documentType={documentType}
      returnTo={returnTo}
      canManage={canManage}
    />
  );
}

export default function EmployeeDocumentTypeEditPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
        </PageContainer>
      }
    >
      <EmployeeDocumentTypeEditContent />
    </Suspense>
  );
}
