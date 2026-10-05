"use client";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { CompOffWorkspace } from "@/features/comp-off";
import { LeaveSetupPathBanner } from "@/features/leave/components/leave-setup-path-banner";

export default function CompOffPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Comp-off Credits"
        description="Credits earned from approved overtime (Comp-off settlement). Revoke only unused available credits and always give a reason."
      />
      <LeaveSetupPathBanner
        current="comp-off"
        note="Source: HR → Overtime approve with Comp-off. Employees spend credits via Apply leave on a Comp-off leave type."
      />
      <CompOffWorkspace />
    </PageContainer>
  );
}
