"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { PageContainer } from "@/components/common/page-container";
import { PermissionGate } from "@/components/common/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAccessEditor } from "@/features/security/components/user-access-editor";
import {
  resolveUsersReturnPath,
  USERS_LIST,
} from "@/features/security/lib/security-navigation";
import { useAuth } from "@/providers/auth-provider";

function UserAccessContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const { hasPermission } = useAuth();
  const returnTo = resolveUsersReturnPath(searchParams.get("return"), USERS_LIST);
  const canManage = hasPermission("security.roles.manage");

  return (
    <PermissionGate
      permission="security.roles.manage"
      fallback="unauthorized"
      unauthorizedTitle="Cannot manage user access"
      unauthorizedDescription="You need security.roles.manage to change role assignments."
    >
      <UserAccessEditor
        userId={id}
        returnTo={returnTo}
        canManage={canManage}
      />
    </PermissionGate>
  );
}

export default function UserAccessPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
        </PageContainer>
      }
    >
      <UserAccessContent />
    </Suspense>
  );
}
