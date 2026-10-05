"use client";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { TransactionsWorkspace } from "@/features/office-finance";

export default function OfficeFinanceTransactionsPage() {
  return (
    <ModuleCapabilityGate capability="financeNav">
      <PageContainer>
        <PageHeader
          title="Transactions"
          description="Create, submit and approve office finance transactions."
        />
        <TransactionsWorkspace />
      </PageContainer>
    </ModuleCapabilityGate>
  );
}
