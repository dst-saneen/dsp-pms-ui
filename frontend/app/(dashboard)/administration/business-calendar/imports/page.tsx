"use client";

import { Suspense } from "react";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BusinessCalendarImportsWorkspace,
  BusinessCalendarShell,
} from "@/features/business-calendar";

export default function BusinessCalendarImportsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Import Holidays"
        description="Bring in holidays from a file or government pack. Review first — nothing publishes automatically."
      />
      <WorkspaceShell>
        <BusinessCalendarShell>
          <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
            <BusinessCalendarImportsWorkspace />
          </Suspense>
        </BusinessCalendarShell>
      </WorkspaceShell>
    </PageContainer>
  );
}
