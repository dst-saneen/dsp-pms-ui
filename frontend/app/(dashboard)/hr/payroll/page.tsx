"use client";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { PayrollWorkspace } from "@/features/payroll";

export default function PayrollPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Payroll"
        description="Monthly payroll runs, salary setup and reports."
      />
      <ModuleCapabilityGate capability="payrollNav">
        <PayrollWorkspace />
      </ModuleCapabilityGate>
    </PageContainer>
  );
}
