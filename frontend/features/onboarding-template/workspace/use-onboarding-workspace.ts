"use client";

import { useQuery } from "@tanstack/react-query";

import { OnboardingWorkspaceService } from "../services/onboarding-workspace-service";

export function useOnboardingWorkspace(id?: string) {
  return useQuery({
    queryKey: ["onboarding-workspace", id],
    enabled: !!id,
    queryFn: () => OnboardingWorkspaceService.getEditor(id!),
  });
}