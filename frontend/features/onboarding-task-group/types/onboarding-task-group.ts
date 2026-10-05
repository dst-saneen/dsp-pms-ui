import type { OnboardingTemplateTask } from "@/features/onboarding-template";

export interface OnboardingTaskGroup {
  id: string;

  onboardingDepartmentTemplateId: string;

  groupCode?: string | null;

  groupName: string;

  description?: string | null;

  displayOrder: number;

  isMandatory: boolean;

  isActive: boolean;

  rowVersion: number;

  createdAt: string;

  updatedAt: string;

  departmentTemplate?: {
    id: string;

    version: {
      id: string;

      onboardingTemplateId: string;
    };

    department: {
      id: string;

      departmentName: string;
    };
  };

  tasks: OnboardingTemplateTask[];
}
