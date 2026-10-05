import type { OnboardingWorkflowStep } from "./onboarding-workflow-step";

export interface OnboardingWorkflow {
  id: string;

  templateId: string;

  version: number;

  isPublished: boolean;

  steps: OnboardingWorkflowStep[];
}