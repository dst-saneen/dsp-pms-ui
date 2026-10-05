"use client";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import {
  BusinessCalendarShell,
  BusinessCalendarWorkspace,
} from "@/features/business-calendar";

export default function BusinessCalendarAdminPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Business Calendar"
        description="Manage holiday calendars for each company and branch."
      />
      <WorkspaceShell>
        <BusinessCalendarShell>
          <BusinessCalendarWorkspace />
        </BusinessCalendarShell>
      </WorkspaceShell>
    </PageContainer>
  );
}
