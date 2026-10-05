"use client";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import {
  BusinessCalendarPreviewWorkspace,
  BusinessCalendarShell,
} from "@/features/business-calendar";

export default function BusinessCalendarPreviewPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Calendar Preview"
        description="Check whether a date is a working day, holiday, week off, or half day."
      />
      <WorkspaceShell>
        <BusinessCalendarShell>
          <BusinessCalendarPreviewWorkspace />
        </BusinessCalendarShell>
      </WorkspaceShell>
    </PageContainer>
  );
}
