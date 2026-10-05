"use client";

import { DataTable } from "@/components/tables/data-table";

import { onboardingTaskColumns } from "./employee-onboarding-task-columns";

import type { EmployeeOnboardingTask } from "../types/employee-onboarding-task";

interface Props {
  tasks: EmployeeOnboardingTask[];
}

export function OnboardingTaskTable({
  tasks,
}: Props) {
  return (
    <DataTable
      columns={onboardingTaskColumns()}
      data={tasks}
    />
  );
}