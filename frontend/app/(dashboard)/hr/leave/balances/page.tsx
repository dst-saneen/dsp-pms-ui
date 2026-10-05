"use client";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { EmployeeLeaveBalanceWorkspace } from "@/features/leave-balance";
import { LeaveSetupPathBanner } from "@/features/leave/components/leave-setup-path-banner";

export default function LeaveBalancesPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Employee Leave Balance"
        description="Employees in your scope with each leave type’s entitlement, used, pending, and available balance."
      />
      <LeaveSetupPathBanner
        current="balances"
        note="Preview first (checks counts). Create balances adds missing yearly days; existing used days stay."
      />
      <EmployeeLeaveBalanceWorkspace />
    </PageContainer>
  );
}
