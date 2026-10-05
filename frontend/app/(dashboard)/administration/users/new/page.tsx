"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { PageContainer } from "@/components/common/page-container";
import { PermissionGate } from "@/components/common/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { UserInviteEditor } from "@/features/security/components/user-invite-editor";
import {
  resolveUsersReturnPath,
  USERS_LIST,
} from "@/features/security/lib/security-navigation";
import { useAuth } from "@/providers/auth-provider";

function UserInviteContent() {
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const returnTo = resolveUsersReturnPath(searchParams.get("return"), USERS_LIST);
  const canManage = hasPermission("security.users.manage");
  const employeeId = searchParams.get("employeeId")?.trim() || undefined;

  return (
    <PermissionGate
      permission="security.users.manage"
      fallback="unauthorized"
      unauthorizedTitle="Cannot invite users"
      unauthorizedDescription="You need security.users.manage to invite users."
    >
      <UserInviteEditor
        returnTo={returnTo}
        canManage={canManage}
        prefill={
          employeeId
            ? {
                employeeId,
                lockEmployee: true,
              }
            : undefined
        }
      />
    </PermissionGate>
  );
}

export default function UserInvitePage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
        </PageContainer>
      }
    >
      <UserInviteContent />
    </Suspense>
  );
}
