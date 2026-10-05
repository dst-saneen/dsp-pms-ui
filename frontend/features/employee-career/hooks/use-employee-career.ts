"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/services/api-client";

import { employeeCareerKeys } from "./query-keys";
import { EmployeeCareerService } from "../services/employee-career-service";
import type { CareerTimelineView } from "../types/career-timeline";
import type { ConfirmActiveDto } from "../types/probation";

function getMutationErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    if (error.message === "STALE_STATE") {
      return "This employee record was updated elsewhere. Refresh and try again.";
    }
    if (error.message === "REASON_REQUIRED") {
      return "A confirmation note is required.";
    }
    if (error.message === "CONFIRMATION_NOT_ALLOWED") {
      return "Active confirmation is not allowed yet for this employee.";
    }
    if (error.message === "PROBATION_OVERRIDE_FORBIDDEN") {
      return "Early probation confirmation requires a distinct override permission.";
    }
    if (error.message === "PROBATION_OVERRIDE_REASON_REQUIRED") {
      return "A structured override reason is required for early confirmation.";
    }
  }

  return getApiErrorMessage(error, fallback);
}

function invalidateCareerQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  employeeId?: string,
) {
  void queryClient.invalidateQueries({ queryKey: employeeCareerKeys.all });
  void queryClient.invalidateQueries({ queryKey: ["employee", employeeId] });
  void queryClient.invalidateQueries({ queryKey: ["employees"] });
}

export function useEmployeeCareerTimeline(
  employeeId?: string,
  view: CareerTimelineView = "HR",
) {
  return useQuery({
    queryKey: employeeCareerKeys.timeline(employeeId ?? "", view),
    queryFn: () => EmployeeCareerService.getTimeline(employeeId!, view),
    enabled: Boolean(employeeId),
  });
}

export function useMyCareerTimeline(employeeId?: string, enabled = true) {
  return useQuery({
    queryKey: employeeCareerKeys.timeline(employeeId ?? "me", "SANITIZED"),
    queryFn: () => EmployeeCareerService.getTimeline(employeeId!, "SANITIZED"),
    enabled: enabled && Boolean(employeeId),
  });
}

export function useProbationDueQueue() {
  return useQuery({
    queryKey: employeeCareerKeys.probationQueue(),
    queryFn: () => EmployeeCareerService.listProbationDue(),
  });
}

export function useProbationPreflight(employeeId?: string) {
  return useQuery({
    queryKey: employeeCareerKeys.probationPreflight(employeeId ?? ""),
    queryFn: () => EmployeeCareerService.getProbationPreflight(employeeId!),
    enabled: Boolean(employeeId),
  });
}

export function useConfirmActive(employeeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: ConfirmActiveDto) =>
      EmployeeCareerService.confirmActive(employeeId, dto),
    onSuccess: () => {
      invalidateCareerQueries(queryClient, employeeId);
      toast.success("Employee confirmed as active.");
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, "Unable to confirm employee as active."));
    },
  });
}
