"use client";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import {
  BusinessCalendarImpactsWorkspace,
  BusinessCalendarShell,
} from "@/features/business-calendar";

export default function BusinessCalendarImpactsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Review Changes"
        description="After a published calendar is edited, review leave or shift rows that may need follow-up."
      />
      <WorkspaceShell>
        <BusinessCalendarShell>
          <BusinessCalendarImpactsWorkspace />
        </BusinessCalendarShell>
      </WorkspaceShell>
    </PageContainer>
  );
}
