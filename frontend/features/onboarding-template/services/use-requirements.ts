"use client";

import { useQuery } from "@tanstack/react-query";

import { RequirementService } from "./requirement.service";

export function useRequirements() {

  return useQuery({

    queryKey: [
      "onboarding-requirements",
    ],

    queryFn: () =>
      RequirementService.getAll(),

  });

}