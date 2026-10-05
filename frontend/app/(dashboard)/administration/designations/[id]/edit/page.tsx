"use client";

import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { AuthzState } from "@/components/common/authz-state";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { DesignationEditor } from "@/features/designation/components/designation-editor";
import { useDesignation } from "@/features/designation/hooks/use-designation";
import {
  DESIGNATION_LIST,
  resolveDesignationReturnPath,
} from "@/features/designation/lib/designation-navigation";
import { useAuth } from "@/providers/auth-provider";

function DesignationEditContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const { hasPermission } = useAuth();
  const canManage = hasPermission("organization.structure.manage");
  const canRead = hasPermission("organization.structure.read") || canManage;

  const returnTo = resolveDesignationReturnPath(
    searchParams.get("return"),
    searchParams.get("source"),
    DESIGNATION_LIST,
  );

  const { data: designation, isLoading, isError } = useDesignation(id);

  if (!canRead) {
    return (
      <PageContainer>
        <AuthzState
          variant="unauthorized"
          title="Cannot view this designation"
          description="You need organization.structure.read to open designation details."
          actionLabel="Back to designations"
          onAction={() => router.push(DESIGNATION_LIST)}
        />
      </PageContainer>
    );
  }

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader
          title="Edit Designation"
          description="Loading designation…"
        />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </PageContainer>
    );
  }

  if (isError || !designation) {
    return (
      <PageContainer>
        <AuthzState
          variant="not-found"
          title="Designation not found"
          description="This designation may have been deleted or is outside your organization scope."
          actionLabel="Back to designations"
          onAction={() => router.push(DESIGNATION_LIST)}
        />
      </PageContainer>
    );
  }

  if (!canManage) {
    return (
      <PageContainer>
        <AuthzState
          variant="unauthorized"
          title="Cannot edit designations"
          description="Only Organization Owner / Company Admin can create or edit designations. HR can view this list and manage checklist departments from Onboarding Templates."
          actionLabel="Back to designations"
          onAction={() => router.push(DESIGNATION_LIST)}
        />
      </PageContainer>
    );
  }

  return (
    <DesignationEditor
      mode="edit"
      designation={designation}
      returnTo={returnTo}
      canManage={canManage}
    />
  );
}

export default function DesignationEditPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
        </PageContainer>
      }
    >
      <DesignationEditContent />
    </Suspense>
  );
}
