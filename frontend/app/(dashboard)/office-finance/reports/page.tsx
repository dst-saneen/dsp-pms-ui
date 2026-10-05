"use client";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { ReportsWorkspace } from "@/features/office-finance";

export default function OfficeFinanceReportsPage() {
  return (
    <ModuleCapabilityGate capability="financeNav">
      <PageContainer>
        <PageHeader title="Reports" description="Income, expense and cash movement reports." />
        <ReportsWorkspace />
      </PageContainer>
    </ModuleCapabilityGate>
  );
}
