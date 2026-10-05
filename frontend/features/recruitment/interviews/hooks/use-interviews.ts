"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { recruitmentKeys } from "../../hooks/query-keys";
import { getApiErrorMessage } from "@/services/api-client";

import { InterviewService } from "../services/interview-service";
import type {
  CancelInterviewDto,
  CompleteInterviewDto,
  InterviewSearch,
  RescheduleInterviewDto,
  SaveEvaluationDraftDto,
  ScheduleInterviewDto,
  SubmitEvaluationDto,
} from "../types/interview";

function getMutationErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    if (error.message === "STALE_STATE") {
      return "This interview was updated elsewhere. Refresh and try again.";
    }
    if (error.message === "APPLICATION_NOT_IN_INTERVIEW") {
      return "Move the application to Interview status before scheduling.";
    }
    if (error.message === "REASON_REQUIRED") {
      return "A reason is required for this action.";
    }
    if (error.message === "EVALUATION_IMMUTABLE") {
      return "Submitted evaluations cannot be edited.";
    }
    if (error.message === "NOT_ASSIGNED") {
      return "You are not assigned to this interview panel.";
    }
  }

  return getApiErrorMessage(error, fallback);
}

function invalidateInterviewQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  applicationId?: string,
) {
  void queryClient.invalidateQueries({
    queryKey: recruitmentKeys.interviews.all(),
  });

  if (applicationId) {
    void queryClient.invalidateQueries({
      queryKey: recruitmentKeys.applications.detail(applicationId),
    });
  }

  void queryClient.invalidateQueries({
    queryKey: recruitmentKeys.applications.all(),
  });
  void queryClient.invalidateQueries({
    queryKey: recruitmentKeys.hiringDecisions.all(),
  });
}

export function useInterviewSessions(filters?: InterviewSearch) {
  return useQuery({
    queryKey: recruitmentKeys.interviews.list(filters),
    queryFn: () => InterviewService.getAll(filters),
  });
}

export function useInterviewSession(id?: string) {
  return useQuery({
    queryKey: [...recruitmentKeys.interviews.all(), "detail", id ?? ""] as const,
    queryFn: () => InterviewService.getById(id!),
    enabled: Boolean(id),
  });
}

export function useApplicationInterviews(applicationId?: string) {
  return useQuery({
    queryKey: [...recruitmentKeys.applications.detail(applicationId ?? ""), "interviews"] as const,
    queryFn: () => InterviewService.getByApplication(applicationId!),
    enabled: Boolean(applicationId),
  });
}

export function useAssignedInterviews(panelMemberEmployeeId?: string) {
  return useQuery({
    queryKey: [...recruitmentKeys.interviews.all(), "assigned", panelMemberEmployeeId ?? ""] as const,
    queryFn: () => InterviewService.getAssigned(panelMemberEmployeeId!),
    enabled: Boolean(panelMemberEmployeeId),
  });
}

export function useMyInterviewEvaluation(sessionId?: string) {
  return useQuery({
    queryKey: [...recruitmentKeys.interviews.all(), "my-evaluation", sessionId ?? ""] as const,
    queryFn: () => InterviewService.getMyEvaluation(sessionId!),
    enabled: Boolean(sessionId),
  });
}

export function useScheduleInterview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ScheduleInterviewDto) => InterviewService.schedule(data),
    onSuccess: (session) => {
      invalidateInterviewQueries(queryClient, session.jobApplicationId);
      toast.success("Interview scheduled.");
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, "Unable to schedule interview."));
    },
  });
}

export function useRescheduleInterview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      applicationId,
      data,
    }: {
      id: string;
      applicationId?: string;
      data: RescheduleInterviewDto;
    }) => InterviewService.reschedule(id, data, applicationId),
    onSuccess: (session) => {
      invalidateInterviewQueries(queryClient, session.jobApplicationId);
      toast.success("Interview rescheduled.");
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, "Unable to reschedule interview."));
    },
  });
}

export function useCancelInterview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      applicationId,
      data,
    }: {
      id: string;
      applicationId?: string;
      data: CancelInterviewDto;
    }) => InterviewService.cancel(id, data, applicationId),
    onSuccess: (session) => {
      invalidateInterviewQueries(queryClient, session.jobApplicationId);
      toast.success("Interview cancelled.");
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, "Unable to cancel interview."));
    },
  });
}

export function useCompleteInterview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      applicationId,
      data,
    }: {
      id: string;
      applicationId?: string;
      data: CompleteInterviewDto;
    }) => InterviewService.complete(id, data, applicationId),
    onSuccess: (session) => {
      invalidateInterviewQueries(queryClient, session.jobApplicationId);
      toast.success("Interview marked complete.");
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, "Unable to complete interview."));
    },
  });
}

export function useSaveEvaluationDraft(panelMemberEmployeeId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sessionId,
      data,
    }: {
      sessionId: string;
      data: SaveEvaluationDraftDto;
    }) =>
      InterviewService.saveMyEvaluationDraft(
        sessionId,
        panelMemberEmployeeId!,
        data,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: recruitmentKeys.interviews.all(),
      });
      toast.success("Evaluation draft saved.");
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, "Unable to save evaluation draft."));
    },
  });
}

export function useSubmitEvaluation(panelMemberEmployeeId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sessionId,
      data,
    }: {
      sessionId: string;
      data: SubmitEvaluationDto;
    }) =>
      InterviewService.submitMyEvaluation(
        sessionId,
        panelMemberEmployeeId!,
        data,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: recruitmentKeys.interviews.all(),
      });
      void queryClient.invalidateQueries({
        queryKey: recruitmentKeys.applications.all(),
      });
      toast.success("Evaluation submitted.");
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, "Unable to submit evaluation."));
    },
  });
}
