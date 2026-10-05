"use client";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { LeaveSetupPathBanner } from "@/features/leave/components/leave-setup-path-banner";
import { LeavePolicyWorkspace } from "@/features/leave-policy";

export default function LeavePoliciesPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Leave Policies"
        description="Decide how many leave days each job role gets each year, and whether unused days can move to next year."
      />
      <LeaveSetupPathBanner
        current="policies"
        note="Saving here only stores the rules. Employees get those days after you run Generate balances."
      />
      <LeavePolicyWorkspace />
    </PageContainer>
  );
}
