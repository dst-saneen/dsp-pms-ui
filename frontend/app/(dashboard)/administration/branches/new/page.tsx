"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { PageContainer } from "@/components/common/page-container";
import { PermissionGate } from "@/components/common/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { BranchEditor } from "@/features/branch/components/branch-editor";
import { resolveBranchReturnPath } from "@/features/branch/lib/branch-navigation";
import { useAuth } from "@/providers/auth-provider";

function BranchCreateContent() {
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const returnTo = resolveBranchReturnPath(searchParams.get("return"));
  const canManage = hasPermission("organization.branches.manage");
  const defaultCompanyId = searchParams.get("companyId") ?? undefined;

  return (
    <PermissionGate
      permission="organization.branches.manage"
      fallback="unauthorized"
      unauthorizedTitle="Cannot create branches"
      unauthorizedDescription="You need organization.branches.manage to create a branch."
    >
      <BranchEditor
        mode="create"
        returnTo={returnTo}
        canManage={canManage}
        defaultCompanyId={defaultCompanyId}
      />
    </PermissionGate>
  );
}

export default function BranchCreatePage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
        </PageContainer>
      }
    >
      <BranchCreateContent />
    </Suspense>
  );
}
