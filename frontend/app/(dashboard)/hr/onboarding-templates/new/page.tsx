"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";

import { OnboardingTemplateForm } from "@/features/onboarding-template/forms";

import { useCreateOnboardingTemplate } from "@/features/onboarding-template/hooks";

export default function NewOnboardingTemplatePage() {
  const router = useRouter();

  const createTemplate = useCreateOnboardingTemplate();

  return (
    <PageContainer>
      <PageHeader
        title="New Onboarding Template"
        description="Create the template before designing its employee workflow."
        actions={
          <Button variant="outline" onClick={() => router.push("/hr/onboarding-templates")}>
            Cancel
          </Button>
        }
      />

      <ModuleCapabilityGate capability="onboardingNav">
      <OnboardingTemplateForm
        submitLabel="Create Template"
        onSubmit={async (values) => {
          const template = await createTemplate.mutateAsync(values);

          router.push(`/hr/onboarding-templates/${template.id}`);
        }}
      />
      </ModuleCapabilityGate>
    </PageContainer>
  );
}
