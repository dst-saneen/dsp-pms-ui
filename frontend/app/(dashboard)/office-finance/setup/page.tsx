"use client";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { SetupWorkspace } from "@/features/office-finance";

export default function OfficeFinanceSetupPage() {
  return (
    <ModuleCapabilityGate capability="financeNav">
      <PageContainer>
        <PageHeader
          title="Setup"
          description="Configure financial profile, parties, categories, accounts and periods."
        />
        <SetupWorkspace />
      </PageContainer>
    </ModuleCapabilityGate>
  );
}
