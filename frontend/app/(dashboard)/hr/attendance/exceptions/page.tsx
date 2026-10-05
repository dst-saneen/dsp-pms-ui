"use client";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { AttendanceExceptionWorkspace } from "@/features/attendance-exception";

export default function AttendanceExceptionsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Attendance exceptions"
        description="HR: use Daily → Correct to fix a day (clears issues here). Propose fix is only when a manager must approve."
      />
      <AttendanceExceptionWorkspace />
    </PageContainer>
  );
}
