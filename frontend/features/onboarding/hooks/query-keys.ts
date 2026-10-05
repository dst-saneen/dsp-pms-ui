import type {
  DepartmentOnboardingQueueQuery,
  MyOnboardingTasksQuery,
  OnboardingPreflightQuery,
} from "../types/onboarding.types";

export const onboardingKeys = {
  all: ["onboarding"] as const,

  lists: () => [...onboardingKeys.all, "list"] as const,

  list: (filters?: unknown) =>
    [...onboardingKeys.lists(), filters] as const,

  details: () => [...onboardingKeys.all, "detail"] as const,

  detail: (onboardingId: string) =>
    [...onboardingKeys.details(), onboardingId] as const,

  preflight: (params: OnboardingPreflightQuery) =>
    [...onboardingKeys.all, "preflight", params] as const,

  me: () => [...onboardingKeys.all, "me"] as const,

  workspaceCapabilities: () =>
    [...onboardingKeys.all, "workspace-capabilities"] as const,

  completionPreflight: (onboardingId: string) =>
    [...onboardingKeys.all, "completion-preflight", onboardingId] as const,
};

export const onboardingTaskKeys = {
  all: ["onboarding-task"] as const,

  me: (filters?: MyOnboardingTasksQuery) =>
    [...onboardingTaskKeys.all, "me", filters] as const,

  departmentQueue: (filters?: DepartmentOnboardingQueueQuery) =>
    [...onboardingTaskKeys.all, "department-queue", filters] as const,

  details: () => [...onboardingTaskKeys.all, "detail"] as const,

  detail: (taskId: string) =>
    [...onboardingTaskKeys.details(), taskId] as const,

  assigneeCandidates: (
    taskId: string,
    keyword?: string,
    page?: number,
  ) =>
    [
      ...onboardingTaskKeys.all,
      "assignee-candidates",
      taskId,
      { keyword, page },
    ] as const,

  assetCandidates: (taskId: string, keyword?: string, page?: number) =>
    [
      ...onboardingTaskKeys.all,
      "asset-candidates",
      taskId,
      { keyword, page },
    ] as const,

  reopenPreflight: (taskId: string, version?: number) =>
    [...onboardingTaskKeys.all, "reopen-preflight", taskId, version] as const,

  history: (taskId: string, page: number, limit: number) =>
    [...onboardingTaskKeys.all, "history", taskId, { page, limit }] as const,
};
