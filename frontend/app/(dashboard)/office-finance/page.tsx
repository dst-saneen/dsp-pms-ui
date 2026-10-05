"use client";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { OfficeFinanceDashboard } from "@/features/office-finance";

export default function OfficeFinancePage() {
  return (
    <ModuleCapabilityGate capability="financeNav">
      <PageContainer>
        <PageHeader
          title="Office Finance"
          description="Monthly income, expense and cash movement summary."
        />
        <OfficeFinanceDashboard />
      </PageContainer>
    </ModuleCapabilityGate>
  );
}
