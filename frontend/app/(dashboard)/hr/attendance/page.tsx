"use client";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { AttendanceDashboard } from "@/features/attendance";

export default function AttendancePage() {
  return (
    <PageContainer>
      <PageHeader
        title="Attendance"
        description="Review employee check-in and check-out records."
      />
      <AttendanceDashboard />
    </PageContainer>
  );
}
