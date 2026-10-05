"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamTimesheetsWorkspace } from "@/features/projects";

const ALLOWED_STATUS = new Set([
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "RETURNED",
]);

function TeamTimesheetsContent() {
  const searchParams = useSearchParams();
  const raw = (searchParams.get("status") ?? "SUBMITTED").toUpperCase();
  const statusFilter = ALLOWED_STATUS.has(raw) ? raw : "SUBMITTED";

  return (
    <ModuleCapabilityGate capability="projectsNav">
      <TeamTimesheetsWorkspace statusFilter={statusFilter} />
    </ModuleCapabilityGate>
  );
}

export default function TeamTimesheetsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Team timesheets"
        description="Approve or return timesheets for employees who report to you."
      />
      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        <TeamTimesheetsContent />
      </Suspense>
    </PageContainer>
  );
}
