"use client";

import { getApiErrorMessage } from "@/services/api-client";
import { useAuth } from "@/providers/auth-provider";

import { EMPLOYEE_CAREER_PERMISSIONS } from "../constants/permissions";
import { useEmployeeCareerTimeline } from "../hooks/use-employee-career";
import { CareerTimeline } from "./career-timeline";

interface EmployeeCareerTabProps {
  employeeId: string;
}

export function EmployeeCareerTab({ employeeId }: EmployeeCareerTabProps) {
  const { hasPermission } = useAuth();
  const canReadHrView = hasPermission(EMPLOYEE_CAREER_PERMISSIONS.read);
  const view = canReadHrView ? "HR" : "SANITIZED";

  const timelineQuery = useEmployeeCareerTimeline(employeeId, view);

  if (timelineQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading career timeline…</p>;
  }

  if (timelineQuery.error) {
    return (
      <p className="text-sm text-destructive">
        {getApiErrorMessage(timelineQuery.error, "We could not load the career timeline.")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {view === "HR"
          ? "Full recruitment and lifecycle milestones, including HR-only references where permitted."
          : "Sanitized career milestones. Confidential recruitment details are not shown here."}
      </p>
      <CareerTimeline
        events={timelineQuery.data?.events ?? []}
        showHrDetail={view === "HR"}
      />
    </div>
  );
}
