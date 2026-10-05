"use client";

import { useParams } from "next/navigation";
import { PanelsTopLeft } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageContainer } from "@/components/common/page-container";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { OnboardingTemplateEditor } from "@/features/onboarding-template/editor";
import { useOnboardingWorkspace } from "@/features/onboarding-template/workspace";
import { getApiErrorMessage } from "@/services/api-client";

export default function OnboardingTemplateDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const {
    data: workspace,
    isLoading,
    error,
    refetch,
  } = useOnboardingWorkspace(id);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-4">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-[560px] rounded-xl" />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <ErrorState
          title="Template unavailable"
          description={getApiErrorMessage(
            error,
            "We could not load this onboarding template.",
          )}
          onRetry={() => {
            void refetch();
          }}
        />
      </PageContainer>
    );
  }

  if (!workspace) {
    return (
      <PageContainer>
        <EmptyState
          icon={PanelsTopLeft}
          title="Onboarding template not found"
          description="This template may no longer be available."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <ModuleCapabilityGate capability="onboardingNav">
        <OnboardingTemplateEditor workspace={workspace} />
      </ModuleCapabilityGate>
    </PageContainer>
  );
}
