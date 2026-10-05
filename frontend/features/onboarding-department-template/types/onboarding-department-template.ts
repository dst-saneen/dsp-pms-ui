import type { Department } from "@/features/department";

import type { OnboardingTaskGroup } from "@/features/onboarding-task-group";

export interface OnboardingDepartmentTemplate {
  id: string;

  onboardingTemplateVersionId: string;

  departmentId: string;

  displayOrder: number;

  isRequired: boolean;

  rowVersion: number;

  approvalWorkflowId?: string | null;

  department?: Department;

  taskGroups: OnboardingTaskGroup[];

  createdAt: string;

  updatedAt: string;
}
