"use client";

import { useQuery } from "@tanstack/react-query";

import { ExecutionProfileService } from "./execution-profile.service";

export function useExecutionProfiles() {

  return useQuery({

    queryKey: [
      "onboarding-execution-profiles",
    ],

    queryFn: () =>
      ExecutionProfileService.getAll(),

  });

}