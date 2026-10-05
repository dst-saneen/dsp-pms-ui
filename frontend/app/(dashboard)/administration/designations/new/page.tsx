"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { PageContainer } from "@/components/common/page-container";
import { PermissionGate } from "@/components/common/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { DesignationEditor } from "@/features/designation/components/designation-editor";
import { resolveDesignationReturnPath } from "@/features/designation/lib/designation-navigation";
import { useAuth } from "@/providers/auth-provider";

function DesignationCreateContent() {
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const returnTo = resolveDesignationReturnPath(
    searchParams.get("return"),
    searchParams.get("source"),
  );
  const canManage = hasPermission("organization.structure.manage");

  return (
    <PermissionGate
      permission="organization.structure.manage"
      fallback="unauthorized"
      unauthorizedTitle="Cannot create designations"
      unauthorizedDescription="You need organization.structure.manage to create a designation."
    >
      <DesignationEditor
        mode="create"
        returnTo={returnTo}
        canManage={canManage}
      />
    </PermissionGate>
  );
}

export default function DesignationCreatePage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
        </PageContainer>
      }
    >
      <DesignationCreateContent />
    </Suspense>
  );
}
