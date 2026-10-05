"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { PageContainer } from "@/components/common/page-container";
import { PermissionGate } from "@/components/common/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { DepartmentEditor } from "@/features/department/components/department-editor";
import { resolveDepartmentReturnPath } from "@/features/department/lib/department-navigation";
import { useAuth } from "@/providers/auth-provider";

function DepartmentCreateContent() {
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const returnTo = resolveDepartmentReturnPath(searchParams.get("return"));
  const canManage = hasPermission("organization.structure.manage");

  return (
    <PermissionGate
      permission="organization.structure.manage"
      fallback="unauthorized"
      unauthorizedTitle="Cannot create departments"
      unauthorizedDescription="You need organization.structure.manage to create a department."
    >
      <DepartmentEditor
        mode="create"
        returnTo={returnTo}
        canManage={canManage}
        defaultCompanyId={searchParams.get("companyId") ?? undefined}
        defaultBranchId={searchParams.get("branchId") ?? undefined}
      />
    </PermissionGate>
  );
}

export default function DepartmentCreatePage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
        </PageContainer>
      }
    >
      <DepartmentCreateContent />
    </Suspense>
  );
}
