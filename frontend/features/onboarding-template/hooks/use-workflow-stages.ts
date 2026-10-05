"use client";

import { useQuery } from "@tanstack/react-query";

import {
  OnboardingWorkflowStageService,
} from "../services";

export function useWorkflowStages(
  workflowId: string,
) {
  return useQuery({

    queryKey: [
      "workflow-stages",
      workflowId,
    ],

    queryFn: () =>
      OnboardingWorkflowStageService.getByWorkflow(
        workflowId,
      ),

    enabled: !!workflowId,
  });
}