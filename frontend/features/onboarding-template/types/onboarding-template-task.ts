import type {
  OnboardingTemplateTask as ApiOnboardingTemplateTask,
} from "@/features/onboarding-template-task";

import type {
  Contribution,
} from "@/features/onboarding-contribution";

// Requirement / ExecutionProfile / ExecutionRule
// will be added later when those modules exist.

export interface WorkspaceOnboardingTemplateTask
  extends ApiOnboardingTemplateTask {

  // ===== Designer-only fields =====

  displayOrder?: number;

  taskType?: string | null;

  completionType?: string | null;

  dependencyTaskIds?: string[];

  requiredDocumentTypeIds?: string[];

  // ===== Workflow References =====

  contributions?: Contribution[];

  // requirements?: Requirement[];

  // executionProfiles?: ExecutionProfile[];

  // executionRules?: ExecutionRule[];

  // ===== Navigation =====

  taskGroup?: {
    id: string;
    groupName: string;
  };

  assignedDepartment?: {
    id: string;
    departmentName: string;
  };

  assignedDesignation?: {
    id: string;
    designationName: string;
  };

  assignedEmployee?: {
    id: string;
    fullName: string;
  };

  approvalWorkflow?: {
    id: string;
    workflowName: string;
  };

  dependsOnTask?: WorkspaceOnboardingTemplateTask;
}

export type OnboardingTemplateTask =
  WorkspaceOnboardingTemplateTask;