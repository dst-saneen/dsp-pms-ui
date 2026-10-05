"use client";

import { useParams } from "next/navigation";

import { PageContainer } from "@/components/common/page-container";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { EmployeeOnboardingEditor } from "@/features/employee-onboarding/editor";

export default function EmployeeOnboardingDetailPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <PageContainer>
      <ModuleCapabilityGate capability="onboardingNav">
        <EmployeeOnboardingEditor onboardingId={id} />
      </ModuleCapabilityGate>
    </PageContainer>
  );
}
