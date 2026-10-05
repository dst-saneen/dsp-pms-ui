"use client";

import { useParams } from "next/navigation";
import { PanelsTopLeft } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { OnboardingTemplateDesigner } from "@/features/onboarding-template";

import { useOnboardingWorkspace } from "@/features/onboarding-template/workspace";

export default function Page() {
  const params = useParams();

  const { data: workspace, isLoading } = useOnboardingWorkspace(params.id as string);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-[560px] rounded-xl" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <EmptyState
        icon={PanelsTopLeft}
        title="Onboarding workspace not found"
        description="This workspace may no longer be available."
      />
    );
  }

  return (
    <ModuleCapabilityGate capability="onboardingNav">
      <OnboardingTemplateDesigner workspace={workspace} />
    </ModuleCapabilityGate>
  );
}
