"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { recruitmentKeys } from "../../hooks/query-keys";
import { getApiErrorMessage } from "@/services/api-client";

import {
  CandidateService,
  JobApplicationService,
} from "../services/job-application-service";
import type { CandidateSearch } from "../../candidates/types/candidate";
import type {
  ApplicationTransitionDto,
  CreateInternalApplicationDto,
  JobApplicationSearch,
} from "../types/job-application";

function getMutationErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    if (error.message === "STALE_STATE") {
      return "This application was updated elsewhere. Refresh and try again.";
    }
    if (error.message === "DUPLICATE_APPLICATION") {
      return "This candidate already has an active application for that opening.";
    }
    if (error.message === "OPENING_NOT_OPEN") {
      return "Applications can only be created for open job openings.";
    }
    if (error.message === "REASON_REQUIRED") {
      return "A reason is required for this action.";
    }
    if (error.message === "INVALID_TRANSITION") {
      return "This action is not allowed for the current application status.";
    }
    if (error.message === "INTERVIEWS_NOT_READY") {
      return "Required interviews and evaluations must be complete first.";
    }
  }

  return getApiErrorMessage(error, fallback);
}

function invalidateApplicationQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  applicationId?: string,
) {
  void queryClient.invalidateQueries({
    queryKey: recruitmentKeys.applications.all(),
  });
  void queryClient.invalidateQueries({
    queryKey: recruitmentKeys.candidates.all(),
  });
  void queryClient.invalidateQueries({
    queryKey: recruitmentKeys.hiringDecisions.all(),
  });

  if (applicationId) {
    void queryClient.invalidateQueries({
      queryKey: recruitmentKeys.applications.detail(applicationId),
    });
  }
}

export function useCandidates(filters?: CandidateSearch) {
  return useQuery({
    queryKey: recruitmentKeys.candidates.list(filters),
    queryFn: () => CandidateService.getAll(filters),
  });
}

export function useCandidate(id?: string) {
  return useQuery({
    queryKey: recruitmentKeys.candidates.detail(id ?? ""),
    queryFn: () => CandidateService.getById(id!),
    enabled: Boolean(id),
  });
}

export function useJobApplications(filters?: JobApplicationSearch) {
  return useQuery({
    queryKey: recruitmentKeys.applications.list(filters),
    queryFn: () => JobApplicationService.getAll(filters),
  });
}

export function useJobApplication(id?: string) {
  return useQuery({
    queryKey: recruitmentKeys.applications.detail(id ?? ""),
    queryFn: () => JobApplicationService.getById(id!),
    enabled: Boolean(id),
  });
}

export function useCandidateApplications(candidateId?: string) {
  return useQuery({
    queryKey: [...recruitmentKeys.candidates.detail(candidateId ?? ""), "applications"],
    queryFn: () => JobApplicationService.getByCandidate(candidateId!),
    enabled: Boolean(candidateId),
  });
}

export function useCreateInternalApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateInternalApplicationDto) =>
      JobApplicationService.createInternal(data),
    onSuccess: (application) => {
      invalidateApplicationQueries(queryClient, application.id);
      toast.success("Application created.");
    },
    onError: (error) => {
      toast.error(
        getMutationErrorMessage(error, "Unable to create application."),
      );
    },
  });
}

function useApplicationTransition(
  action: (id: string, dto: ApplicationTransitionDto) => Promise<import("../types/job-application").JobApplication>,
  successMessage: string,
  errorMessage: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: ApplicationTransitionDto;
    }) => action(id, data),
    onSuccess: (application) => {
      queryClient.setQueryData(
        recruitmentKeys.applications.detail(application.id),
        application,
      );
      invalidateApplicationQueries(queryClient, application.id);
      toast.success(successMessage);
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, errorMessage));
    },
  });
}

export function useShortlistApplication() {
  return useApplicationTransition(
    JobApplicationService.shortlist,
    "Application shortlisted.",
    "Unable to shortlist application.",
  );
}

export function useStartScreening() {
  return useApplicationTransition(
    JobApplicationService.startScreening,
    "Screening started.",
    "Unable to start screening.",
  );
}

export function useAdvanceToInterview() {
  return useApplicationTransition(
    JobApplicationService.advanceToInterview,
    "Application advanced to interview.",
    "Unable to advance application.",
  );
}

export function useAdvanceToManagerReview() {
  return useApplicationTransition(
    JobApplicationService.advanceToManagerReview,
    "Application advanced to hiring manager review.",
    "Unable to advance application to manager review.",
  );
}

export function useRejectApplication() {
  return useApplicationTransition(
    JobApplicationService.reject,
    "Application rejected.",
    "Unable to reject application.",
  );
}

export function useWithdrawApplication() {
  return useApplicationTransition(
    JobApplicationService.withdraw,
    "Application withdrawn.",
    "Unable to withdraw application.",
  );
}
