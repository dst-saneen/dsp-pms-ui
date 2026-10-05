"use client";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { LeaveSetupPathBanner } from "@/features/leave/components/leave-setup-path-banner";
import { HolidayWorkspace } from "@/features/holiday";

export default function HolidaysPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Holidays"
        description="Business Calendar is the holiday source. The previous holiday list stays available only for offices still completing the calendar transition."
      />
      <LeaveSetupPathBanner
        current="holidays"
        note="This list mirrors Business Calendar. Add holiday opens Business Calendar — publish there, then refresh here."
      />
      <HolidayWorkspace />
    </PageContainer>
  );
}
