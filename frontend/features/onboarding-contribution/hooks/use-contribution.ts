"use client";

import { useQuery } from "@tanstack/react-query";

import {
  ContributionService,
} from "../services";

export function useContribution(
  id?: string,
) {
  return useQuery({

    enabled: !!id,

    queryKey: [
      "onboarding-contribution",
      id,
    ],

    queryFn: () =>
      ContributionService.getById(
        id!,
      ),

  });
}