export const onboardingTemplateTaskKeys = {

  all: [
    "onboarding-template-task",
  ] as const,

  lists: () => [
    ...onboardingTemplateTaskKeys.all,
    "list",
  ] as const,

  list: (
    taskGroupId: string,
  ) => [
    ...onboardingTemplateTaskKeys.lists(),
    taskGroupId,
  ] as const,

  details: () => [
    ...onboardingTemplateTaskKeys.all,
    "detail",
  ] as const,

  detail: (
    id: string,
  ) => [
    ...onboardingTemplateTaskKeys.details(),
    id,
  ] as const,

};