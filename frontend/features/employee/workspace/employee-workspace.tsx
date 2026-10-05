"use client";

import { Users } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { getApiErrorMessage } from "@/services/api-client";

import { EmployeeCurrentTask } from "./employee-current-task";
import { EmployeeActivity } from "./employee-activity";
import { EmployeeDashboard } from "./employee-dashboard";
import { EmployeeNotifications } from "./employee-notifications";
import { EmployeeSummaryCards } from "./employee-summary-cards";
import { EmployeeToday } from "./employee-today";
import { EmployeeWorkspaceLoading } from "./employee-workspace-loading";

import { useEmployeeWorkspace } from "./hooks";

interface EmployeeWorkspaceProps {
  employeeId: string;
}

export function EmployeeWorkspace({
  employeeId,
}: EmployeeWorkspaceProps) {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useEmployeeWorkspace(employeeId);

  if (isLoading) {
    return <EmployeeWorkspaceLoading />;
  }

  if (error) {
    return (
      <ErrorState
        title="Employee workspace unavailable"
        description={getApiErrorMessage(
          error,
          "We could not load this workspace. Please try again.",
        )}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon={Users}
        title="Workspace data is not available"
        description="The workspace will appear when employee data is available."
      />
    );
  }

  return (
    <WorkspaceShell>
      <EmployeeDashboard employee={data.employee} />

      <EmployeeSummaryCards summary={data.summary} />

      <div className="grid gap-5 lg:grid-cols-2">
        <EmployeeToday items={data.todaySchedule} />
        <EmployeeCurrentTask task={data.currentTask} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <EmployeeActivity activities={data.recentActivities} />
        <EmployeeNotifications notifications={data.notifications} />
      </div>
    </WorkspaceShell>
  );
}
