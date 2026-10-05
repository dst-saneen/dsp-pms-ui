export const onboardingTemplateKeys = {

  all: ["onboarding-template"] as const,

  lists: () =>
    [...onboardingTemplateKeys.all, "list"] as const,

  list: (params?: unknown) =>
    [...onboardingTemplateKeys.lists(), params] as const,

  details: () =>
    [...onboardingTemplateKeys.all, "detail"] as const,

  detail: (id: string) =>
    [...onboardingTemplateKeys.details(), id] as const,

  summary: () =>
    [...onboardingTemplateKeys.all, "summary"] as const,

  workspace: (
    templateId: string,
  ) =>
    [
      ...onboardingTemplateKeys.all,
      "workspace",
      templateId,
    ] as const,

  versionHistory: (templateId: string) =>
    [
      ...onboardingTemplateKeys.all,
      "version-history",
      templateId,
    ] as const,

};