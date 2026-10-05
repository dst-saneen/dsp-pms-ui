import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { EmployeeOnboardingDashboard } from "@/features/employee-onboarding/dashboard";

export default function EmployeeOnboardingPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Employee Onboarding"
        description="Track employee onboarding progress and assigned workflows."
      />
      <ModuleCapabilityGate capability="onboardingNav">
        <EmployeeOnboardingDashboard />
      </ModuleCapabilityGate>
    </PageContainer>
  );
}
