"use client";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { AttendancePeriodWorkspace } from "@/features/attendance-period";

export default function AttendancePeriodsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Attendance period closing"
        description="Lock a finished month for payroll after Daily and Exceptions are clean."
      />
      <AttendancePeriodWorkspace />
    </PageContainer>
  );
}
