import type { CreateOnboardingTemplateTask } from "./create-onboarding-template-task";

export type UpdateOnboardingTemplateTask =
  Partial<Omit<CreateOnboardingTemplateTask, "taskGroupId">> & {
    expectedVersion: number;
  };
