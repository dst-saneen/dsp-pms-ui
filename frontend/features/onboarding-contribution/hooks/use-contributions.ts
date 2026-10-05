"use client";

import { useQuery } from "@tanstack/react-query";

import {
  ContributionService,
} from "../services";

export function useContributions() {
  return useQuery({

    queryKey: [
      "onboarding-contribution",
    ],

    queryFn: () =>
      ContributionService.getAll(),

  });
}