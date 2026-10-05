"use client";

import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { AuthzState } from "@/components/common/authz-state";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployeeDocumentEditor } from "@/features/employee-document/components/employee-document-editor";
import { useEmployeeDocument } from "@/features/employee-document/hooks/use-employee-document";
import {
  EMPLOYEE_DOCUMENT_LIST,
  resolveEmployeeDocumentReturnPath,
} from "@/features/employee-document/lib/employee-document-navigation";
import { useAuth } from "@/providers/auth-provider";

function EmployeeDocumentEditContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const { hasPermission } = useAuth();
  const canManage = hasPermission("hr.documents.manage");
  const canRead = hasPermission("hr.documents.read") || canManage;
  const returnTo = resolveEmployeeDocumentReturnPath(
    searchParams.get("return"),
    EMPLOYEE_DOCUMENT_LIST,
  );
  const { data: document, isLoading, isError } = useEmployeeDocument(id);

  if (!canRead) {
    return (
      <PageContainer>
        <AuthzState
          variant="unauthorized"
          title="Cannot view this document"
          description="You need hr.documents.read to open employee document details."
          actionLabel="Back to documents"
          onAction={() => router.push(EMPLOYEE_DOCUMENT_LIST)}
        />
      </PageContainer>
    );
  }

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader
          title="Edit Employee Document"
          description="Loading document…"
        />
        <Skeleton className="h-64 rounded-xl" />
      </PageContainer>
    );
  }

  if (isError || !document) {
    return (
      <PageContainer>
        <AuthzState
          variant="not-found"
          title="Employee document not found"
          description="This document may have been deleted or is outside your organization scope."
          actionLabel="Back to documents"
          onAction={() => router.push(EMPLOYEE_DOCUMENT_LIST)}
        />
      </PageContainer>
    );
  }

  if (!canManage) {
    return (
      <PageContainer>
        <AuthzState
          variant="unauthorized"
          title="Cannot edit employee documents"
          description="You can view the list, but hr.documents.manage is required to edit."
          actionLabel="Back to documents"
          onAction={() => router.push(EMPLOYEE_DOCUMENT_LIST)}
        />
      </PageContainer>
    );
  }

  return (
    <EmployeeDocumentEditor
      mode="edit"
      document={document}
      returnTo={returnTo}
      canManage={canManage}
    />
  );
}

export default function EmployeeDocumentEditPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
        </PageContainer>
      }
    >
      <EmployeeDocumentEditContent />
    </Suspense>
  );
}
