import type { EmployeeOnboarding } from "./employee-onboarding";
import type { EmployeeOnboardingTask } from "./employee-onboarding-task";

export interface EmployeeOnboardingEditorModel {
  onboarding: EmployeeOnboarding;

  tasks: EmployeeOnboardingTask[];

  totalTasks: number;

  completedTasks: number;

  progress: number;

  mandatoryCompleted: boolean;

  canComplete: boolean;
}