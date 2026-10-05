"use client";

import { useQuery } from "@tanstack/react-query";

import {
  DesignationOnboardingWorkspaceService,
} from "../services/designation-onboarding-workspace-service";

export function useDesignationOnboardingWorkspace(
  searchParams?: {
    keyword?: string;
    companyId?: string;
  },
) {
  return useQuery({
    queryKey: [
      "designation-onboarding-workspace",
      searchParams,
    ],

    queryFn: () =>
      DesignationOnboardingWorkspaceService.getAll(
        searchParams,
      ),
  });
}
