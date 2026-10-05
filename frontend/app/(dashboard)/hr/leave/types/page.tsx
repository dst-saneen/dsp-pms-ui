"use client";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { LeaveSetupPathBanner } from "@/features/leave/components/leave-setup-path-banner";
import { LeaveTypeWorkspace } from "@/features/leave-type";

export default function LeaveTypesPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Leave Types"
        description="Company-wise leave codes and rules. Carry forward on/off lives here; day amounts are set under Policies."
      />
      <LeaveSetupPathBanner
        current="types"
        note="Next: Policies → set days/year by designation, then Generate balances."
      />
      <LeaveTypeWorkspace />
    </PageContainer>
  );
}
