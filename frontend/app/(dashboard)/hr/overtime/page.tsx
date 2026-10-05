"use client";

import Link from "next/link";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { OvertimeWorkspace } from "@/features/overtime";

export default function OvertimePage() {
  return (
    <PageContainer>
      <PageHeader
        title="Overtime"
        description="Approve at most eligible minutes. Choose one settlement: Comp-off credit or Payroll pending. Reject/cancel creates neither."
      />
      <div className="mb-4 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        After Comp-off approve, credits appear under{" "}
        <Link className="underline text-foreground" href="/hr/leave/comp-off">
          Leave → Comp-off
        </Link>
        . Users with Overtime approve can decide SUBMITTED rows (even if the
        workflow step names the manager).
      </div>
      <OvertimeWorkspace />
    </PageContainer>
  );
}
