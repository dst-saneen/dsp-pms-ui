"use client";

import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { AuthzState } from "@/components/common/authz-state";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { BranchEditor } from "@/features/branch/components/branch-editor";
import { useBranch } from "@/features/branch/hooks/use-branch";
import {
  BRANCH_LIST,
  resolveBranchReturnPath,
} from "@/features/branch/lib/branch-navigation";
import { useAuth } from "@/providers/auth-provider";

function BranchEditContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const { hasPermission } = useAuth();
  const canManage = hasPermission("organization.branches.manage");
  const canRead = hasPermission("organization.branches.read") || canManage;
  const returnTo = resolveBranchReturnPath(searchParams.get("return"), BRANCH_LIST);
  const { data: branch, isLoading, isError } = useBranch(id);

  if (!canRead) {
    return (
      <PageContainer>
        <AuthzState
          variant="unauthorized"
          title="Cannot view this branch"
          description="You need organization.branches.read to open branch details."
          actionLabel="Back to branches"
          onAction={() => router.push(BRANCH_LIST)}
        />
      </PageContainer>
    );
  }

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Edit Branch" description="Loading branch…" />
        <Skeleton className="h-64 rounded-xl" />
      </PageContainer>
    );
  }

  if (isError || !branch) {
    return (
      <PageContainer>
        <AuthzState
          variant="not-found"
          title="Branch not found"
          description="This branch may have been deleted or is outside your organization scope."
          actionLabel="Back to branches"
          onAction={() => router.push(BRANCH_LIST)}
        />
      </PageContainer>
    );
  }

  if (!canManage) {
    return (
      <PageContainer>
        <AuthzState
          variant="unauthorized"
          title="Cannot edit branches"
          description="You can view the list, but organization.branches.manage is required to edit."
          actionLabel="Back to branches"
          onAction={() => router.push(BRANCH_LIST)}
        />
      </PageContainer>
    );
  }

  return (
    <BranchEditor
      mode="edit"
      branch={branch}
      returnTo={returnTo}
      canManage={canManage}
    />
  );
}

export default function BranchEditPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
        </PageContainer>
      }
    >
      <BranchEditContent />
    </Suspense>
  );
}
