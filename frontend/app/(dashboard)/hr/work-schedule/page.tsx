"use client";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ShiftRosterWorkspace } from "@/features/shift-roster";

export default function WorkSchedulePage() {
  return (
    <PageContainer>
      <PageHeader
        title="Work Schedule"
        description="Create branch schedules, check each person’s days, then publish when ready."
      />
      <ShiftRosterWorkspace />
    </PageContainer>
  );
}
