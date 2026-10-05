export const employeeOnboardingKeys = {
  all: ["employee-onboarding"] as const,

  lists: () =>
    [...employeeOnboardingKeys.all, "list"] as const,

  list: (params?: unknown) =>
    [...employeeOnboardingKeys.lists(), params] as const,

  details: () =>
    [...employeeOnboardingKeys.all, "detail"] as const,

  detail: (id: string) =>
    [...employeeOnboardingKeys.details(), id] as const,
};