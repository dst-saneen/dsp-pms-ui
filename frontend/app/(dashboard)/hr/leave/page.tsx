"use client";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { LeaveSetupPathBanner } from "@/features/leave/components/leave-setup-path-banner";
import { LeaveRequestWorkspace } from "@/features/leave-request";

export default function LeaveRequestsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Leave Requests"
        description="Approve leave for your stage only. Balance stays reserved until HR gives the final approve."
      />
      <LeaveSetupPathBanner
        current="requests"
        note="You only see the queue for your role (Manager or HR). After final approve, check Leave calendar."
      />
      <LeaveRequestWorkspace />
    </PageContainer>
  );
}
