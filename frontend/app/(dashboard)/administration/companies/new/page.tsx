"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { PageContainer } from "@/components/common/page-container";
import { PermissionGate } from "@/components/common/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyEditor } from "@/features/company/components/company-editor";
import { resolveCompanyReturnPath } from "@/features/company/lib/company-navigation";
import { useAuth } from "@/providers/auth-provider";

function CompanyCreateContent() {
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const returnTo = resolveCompanyReturnPath(searchParams.get("return"));
  const canManage = hasPermission("organization.companies.manage");

  return (
    <PermissionGate
      permission="organization.companies.manage"
      fallback="unauthorized"
      unauthorizedTitle="Cannot create companies"
      unauthorizedDescription="You need organization.companies.manage to create a company."
    >
      <CompanyEditor mode="create" returnTo={returnTo} canManage={canManage} />
    </PermissionGate>
  );
}

export default function CompanyCreatePage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
        </PageContainer>
      }
    >
      <CompanyCreateContent />
    </Suspense>
  );
}
