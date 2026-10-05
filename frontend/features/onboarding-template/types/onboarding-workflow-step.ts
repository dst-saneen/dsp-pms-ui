export interface OnboardingWorkflowStep {
  id: string;

  sequenceNo: number;

  stepName: string;

  ownerType: string;

  stepType:
    | "TASK"
    | "APPROVAL";

  approvalRequired: boolean;

  dueDays: number;

  isParallel: boolean;

  autoComplete: boolean;
}