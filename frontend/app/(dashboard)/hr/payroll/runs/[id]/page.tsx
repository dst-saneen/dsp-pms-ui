"use client";

import { use } from "react";

import { PageContainer } from "@/components/common/page-container";
import { PayrollRunDetail } from "@/features/payroll";

export default function PayrollRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <PageContainer>
      <PayrollRunDetail runId={id} />
    </PageContainer>
  );
}
