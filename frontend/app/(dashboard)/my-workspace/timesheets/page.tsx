"use client";

import { Suspense } from "react";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { MyTimesheetsWorkspace } from "@/features/projects";

export default function MyWorkspaceTimesheetsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="My timesheets"
        description="Create a week, add lines against assigned tasks, then submit for approval."
      />
      <ModuleCapabilityGate capability="projectsNav">
        <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
          <MyTimesheetsWorkspace />
        </Suspense>
      </ModuleCapabilityGate>
    </PageContainer>
  );
}
