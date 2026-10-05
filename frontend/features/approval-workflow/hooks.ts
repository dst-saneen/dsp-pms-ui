"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApprovalWorkflowApiService } from "./service";
import type {
  CreateApprovalWorkflowInput,
  CreateApprovalWorkflowStepInput,
} from "./types";

const approvalWorkflowKey = ["approval-workflows"] as const;

export function useApprovalWorkflows() {
  return useQuery({
    queryKey: approvalWorkflowKey,
    queryFn: ApprovalWorkflowApiService.list,
  });
}

export function useCreateApprovalWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateApprovalWorkflowInput) =>
      ApprovalWorkflowApiService.create(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: approvalWorkflowKey }),
  });
}

export function useCreateApprovalWorkflowStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateApprovalWorkflowStepInput) =>
      ApprovalWorkflowApiService.createStep(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: approvalWorkflowKey }),
  });
}
