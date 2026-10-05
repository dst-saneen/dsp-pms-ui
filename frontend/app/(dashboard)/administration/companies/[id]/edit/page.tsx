"use client";

import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { AuthzState } from "@/components/common/authz-state";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyEditor } from "@/features/company/components/company-editor";
import { useCompany } from "@/features/company/hooks/use-company";
import {
  COMPANY_LIST,
  resolveCompanyReturnPath,
} from "@/features/company/lib/company-navigation";
import { useAuth } from "@/providers/auth-provider";

function CompanyEditContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const { hasPermission } = useAuth();
  const canManage = hasPermission("organization.companies.manage");
  const canRead = hasPermission("organization.companies.read") || canManage;
  const returnTo = resolveCompanyReturnPath(
    searchParams.get("return"),
    COMPANY_LIST,
  );
  const { data: company, isLoading, isError } = useCompany(id);

  if (!canRead) {
    return (
      <PageContainer>
        <AuthzState
          variant="unauthorized"
          title="Cannot view this company"
          description="You need organization.companies.read to open company details."
          actionLabel="Back to companies"
          onAction={() => router.push(COMPANY_LIST)}
        />
      </PageContainer>
    );
  }

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Edit Company" description="Loading company…" />
        <Skeleton className="h-64 rounded-xl" />
      </PageContainer>
    );
  }

  if (isError || !company) {
    return (
      <PageContainer>
        <AuthzState
          variant="not-found"
          title="Company not found"
          description="This company may have been deleted or is outside your organization scope."
          actionLabel="Back to companies"
          onAction={() => router.push(COMPANY_LIST)}
        />
      </PageContainer>
    );
  }

  if (!canManage) {
    return (
      <PageContainer>
        <AuthzState
          variant="unauthorized"
          title="Cannot edit companies"
          description="You can view the list, but organization.companies.manage is required to edit."
          actionLabel="Back to companies"
          onAction={() => router.push(COMPANY_LIST)}
        />
      </PageContainer>
    );
  }

  return (
    <CompanyEditor
      mode="edit"
      company={company}
      returnTo={returnTo}
      canManage={canManage}
    />
  );
}

export default function CompanyEditPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
        </PageContainer>
      }
    >
      <CompanyEditContent />
    </Suspense>
  );
}
