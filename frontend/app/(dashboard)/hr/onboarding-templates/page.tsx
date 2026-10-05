import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { OnboardingTemplateDashboard } from "@/features/onboarding-template/dashboard";

export default function OnboardingTemplatePage() {
  return (
    <PageContainer>
      <PageHeader
        title="Onboarding Templates"
        description="Configure reusable onboarding workflows by designation."
      />
      <ModuleCapabilityGate capability="onboardingNav">
        <OnboardingTemplateDashboard />
      </ModuleCapabilityGate>
    </PageContainer>
  );
}
