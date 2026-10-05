"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { PageContainer } from "@/components/common/page-container";
import { PermissionGate } from "@/components/common/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleEditor } from "@/features/security/components/role-editor";
import {
  resolveSecurityReturnPath,
  SECURITY_LIST,
} from "@/features/security/lib/security-navigation";
import { useAuth } from "@/providers/auth-provider";

function RoleEditContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
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
      unauthorizedTitle="Cannot edit roles"
      unauthorizedDescription="You need security.roles.manage and an active Company Group."
    >
      <RoleEditor
        mode="edit"
        roleId={id}
        returnTo={returnTo}
        canManage={canManage}
      />
    </PermissionGate>
  );
}

export default function RoleEditPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
        </PageContainer>
      }
    >
      <RoleEditContent />
    </Suspense>
  );
}
