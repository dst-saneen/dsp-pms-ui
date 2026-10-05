"use client";

import { useQuery } from "@tanstack/react-query";

import {
  OnboardingTemplateTaskService,
} from "../services";

import {
  onboardingTemplateTaskKeys,
} from "./query-keys";

import type {
  OnboardingTemplateTaskSearch,
} from "../types";

export function useOnboardingTemplateTasks(
  search?: OnboardingTemplateTaskSearch,
) {

  return useQuery({

    queryKey: [
      ...onboardingTemplateTaskKeys.lists(),
      search,
    ],

    queryFn: () =>
      OnboardingTemplateTaskService.getAll(
        search,
      ),

  });

}