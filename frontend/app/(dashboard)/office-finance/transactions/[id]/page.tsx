"use client";

import { use } from "react";

import { PageContainer } from "@/components/common/page-container";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { TransactionDetail } from "@/features/office-finance";

export default function OfficeFinanceTransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <ModuleCapabilityGate capability="financeNav">
      <PageContainer>
        <TransactionDetail transactionId={id} />
      </PageContainer>
    </ModuleCapabilityGate>
  );
}
