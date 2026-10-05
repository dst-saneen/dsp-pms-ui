"use client";

import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import { AuthzState } from "@/components/common/authz-state";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyModulesWorkspace } from "@/features/company/components/company-modules-workspace";
import { useCompany } from "@/features/company/hooks/use-company";
import {
  useCompanyModuleEntitlements,
  useUpdateCompanyModuleEntitlements,
} from "@/features/company/hooks/use-company-modules";
import {
  COMPANY_LIST,
  companyEditHref,
} from "@/features/company/lib/company-navigation";
import type { CompanyModuleEntitlement } from "@/features/company/types/company";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

export default function CompanyModulesPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { hasPermission } = useAuth();
  const canManage = hasPermission("organization.companies.manage");
  const canRead = hasPermission("organization.companies.read") || canManage;
  const companyQuery = useCompany(canRead ? id : undefined);
  const entitlementQuery = useCompanyModuleEntitlements(canRead ? id : "");
  const updateMutation = useUpdateCompanyModuleEntitlements(id);

  if (!canRead) {
    return (
      <PageContainer>
        <AuthzState
          variant="unauthorized"
          title="Cannot view Modules & Features"
          description="You need organization.companies.read to review Company modules."
          actionLabel="Back to dashboard"
          onAction={() => router.push("/dashboard")}
        />
      </PageContainer>
    );
  }

  if (companyQuery.isLoading || entitlementQuery.isLoading) {
    return (
      <PageContainer>
        <PageHeader
          title="Modules & Features"
          description="Loading Company module configuration…"
        />
        <Skeleton className="h-96 rounded-xl" />
      </PageContainer>
    );
  }

  if (
    companyQuery.isError ||
    entitlementQuery.isError ||
    !companyQuery.data ||
    !entitlementQuery.data
  ) {
    return (
      <PageContainer>
        <AuthzState
          variant="not-found"
          title="Company configuration not found"
          description="This Company may have been deleted or is outside your organization scope."
          actionLabel="Back to companies"
          onAction={() => router.push(COMPANY_LIST)}
        />
      </PageContainer>
    );
  }

  const save = (entitlements: CompanyModuleEntitlement[]) => {
    updateMutation.mutate(
      { entitlements },
      {
        onSuccess: () => {
          toast.success("Modules & Features updated successfully.");
        },
        onError: (error) => {
          toast.error(
            getApiErrorMessage(
              error,
              "Unable to update Modules & Features.",
            ),
          );
        },
      },
    );
  };

  return (
    <CompanyModulesWorkspace
      company={companyQuery.data}
      entitlements={entitlementQuery.data.entitlements}
      canManage={canManage}
      isSaving={updateMutation.isPending}
      onSave={save}
      onBack={() => router.push(canManage ? companyEditHref(id) : COMPANY_LIST)}
    />
  );
}
