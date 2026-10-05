"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { PageContainer } from "@/components/common/page-container";
import { PermissionGate } from "@/components/common/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleEditor } from "@/features/security/components/role-editor";
import {
  resolveSecurityReturnPath,
  SECURITY_LIST,
} from "@/features/security/lib/security-navigation";
import { useAuth } from "@/providers/auth-provider";

function RoleCreateContent() {
  const searchParams = useSearchParams();
  const { hasPermission, user } = useAuth();
  const returnTo = resolveSecurityReturnPath(
    searchParams.get("return"),
    SECURITY_LIST,
  );
  const canManage =
    hasPermission("security.roles.manage") &&
    Boolean(user?.authorization.activeCompanyGroupId);

  return (
    <PermissionGate
      permission="security.roles.manage"
      fallback="unauthorized"
      unauthorizedTitle="Cannot create roles"
      unauthorizedDescription="You need security.roles.manage and an active Company Group."
    >
      <RoleEditor mode="create" returnTo={returnTo} canManage={canManage} />
    </PermissionGate>
  );
}

export default function RoleCreatePage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
        </PageContainer>
      }
    >
      <RoleCreateContent />
    </Suspense>
  );
}
