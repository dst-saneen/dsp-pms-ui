"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/services/api-client";

import { recruitmentKeys } from "../../hooks/query-keys";
import { HiringDecisionService } from "../services/hiring-decision-service";
import type { HiringDecisionDto } from "../types/hiring-decision";

function getMutationErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    if (error.message === "STALE_STATE") {
      return "This record was updated elsewhere. Refresh and try again.";
    }
    if (error.message === "INVALID_TRANSITION") {
      return "This action is not allowed for the current application status.";
    }
    if (error.message === "REASON_REQUIRED") {
      return "A decision note is required.";
    }
    if (error.message === "UNAUTHORIZED_ACTION") {
      return "You are not authorized to decide on this opening.";
    }
    if (error.message === "HEADCOUNT_UNAVAILABLE") {
      return "No headcount remaining on this opening. Select is blocked to avoid oversubscription.";
    }
    if (error.message === "INTERVIEWS_NOT_READY") {
      return "Required interviews and evaluations must be complete first.";
    }
  }

  return getApiErrorMessage(error, fallback);
}

function invalidateHiringQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  openingId?: string,
  applicationId?: string,
) {
  void queryClient.invalidateQueries({
    queryKey: recruitmentKeys.hiringDecisions.all(),
  });
  void queryClient.invalidateQueries({
    queryKey: recruitmentKeys.applications.all(),
  });

  if (openingId) {
    void queryClient.invalidateQueries({
      queryKey: recruitmentKeys.hiringDecisions.comparison(openingId),
    });
  }

  if (applicationId) {
    void queryClient.invalidateQueries({
      queryKey: recruitmentKeys.applications.detail(applicationId),
    });
  }
}

export function useHiringDecisionQueue(hiringManagerEmployeeId?: string) {
  return useQuery({
    queryKey: recruitmentKeys.hiringDecisions.queue(hiringManagerEmployeeId),
    queryFn: () => HiringDecisionService.getQueue(hiringManagerEmployeeId!),
    enabled: Boolean(hiringManagerEmployeeId),
  });
}

export function useHiringComparison(
  openingId?: string,
  hiringManagerEmployeeId?: string,
) {
  return useQuery({
    queryKey: recruitmentKeys.hiringDecisions.comparison(
      openingId ?? "",
      hiringManagerEmployeeId,
    ),
    queryFn: () =>
      HiringDecisionService.getComparison(openingId!, hiringManagerEmployeeId!),
    enabled: Boolean(openingId && hiringManagerEmployeeId),
  });
}

export function useSelectCandidate(hiringManagerEmployeeId: string, openingId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      applicationId,
      data,
    }: {
      applicationId: string;
      data: HiringDecisionDto;
    }) =>
      HiringDecisionService.selectCandidate(
        applicationId,
        hiringManagerEmployeeId,
        data,
      ),
    onSuccess: (application) => {
      invalidateHiringQueries(queryClient, openingId ?? application.jobOpeningId, application.id);
      toast.success("Candidate selected.");
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, "Unable to select candidate."));
    },
  });
}

export function useRejectCandidateByManager(
  hiringManagerEmployeeId: string,
  openingId?: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      applicationId,
      data,
    }: {
      applicationId: string;
      data: HiringDecisionDto;
    }) =>
      HiringDecisionService.rejectCandidate(
        applicationId,
        hiringManagerEmployeeId,
        data,
      ),
    onSuccess: (application) => {
      invalidateHiringQueries(queryClient, openingId ?? application.jobOpeningId, application.id);
      toast.success("Candidate rejected.");
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, "Unable to reject candidate."));
    },
  });
}
