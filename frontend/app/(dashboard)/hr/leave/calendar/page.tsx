"use client";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { LeaveSetupPathBanner } from "@/features/leave/components/leave-setup-path-banner";
import { WorkforceCalendarWorkspace } from "@/features/workforce-calendar";

export default function WorkforceCalendarPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Leave Calendar"
        description="See who is on leave this month at a glance. Purple cells show the person and leave type; the side list names everyone off without picking a day first."
      />
      <LeaveSetupPathBanner
        current="calendar"
        note="After HR final-approves leave, the person appears on purple days here and on My calendar."
      />
      <WorkforceCalendarWorkspace />
    </PageContainer>
  );
}
