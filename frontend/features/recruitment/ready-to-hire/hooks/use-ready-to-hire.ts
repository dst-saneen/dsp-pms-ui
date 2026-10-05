"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/services/api-client";

import { recruitmentKeys } from "../../hooks/query-keys";
import {
  ReadyToHireService,
  type RetryConversionInvitationInput,
} from "../services/ready-to-hire-service";
import type { ConvertCandidateDto } from "../types/conversion-preflight";

function getMutationErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    if (error.message === "STALE_STATE") {
      return "This application was updated elsewhere. Refresh and try again.";
    }
    if (error.message === "CONVERSION_PREFLIGHT_FAILED") {
      return "Conversion preflight failed. Resolve blockers and try again.";
    }
    if (error.message === "INVALID_TRANSITION") {
      return "Conversion is not allowed for the current application state.";
    }
    if (error.message === "OPERATION_ID_REQUIRED") {
      return "Conversion command receipt is missing. Close and retry the convert dialog.";
    }
  }

  return getApiErrorMessage(error, fallback);
}

function invalidateConversionQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  applicationId?: string,
) {
  void queryClient.invalidateQueries({
    queryKey: recruitmentKeys.readyToHire.all(),
  });
  void queryClient.invalidateQueries({
    queryKey: recruitmentKeys.applications.all(),
  });
  void queryClient.invalidateQueries({
    queryKey: recruitmentKeys.candidates.all(),
  });
  void queryClient.invalidateQueries({
    queryKey: recruitmentKeys.openings.all(),
  });

  if (applicationId) {
    void queryClient.invalidateQueries({
      queryKey: recruitmentKeys.applications.detail(applicationId),
    });
    void queryClient.invalidateQueries({
      queryKey: recruitmentKeys.readyToHire.preflight(applicationId),
    });
  }
}

export function useReadyToHireQueue() {
  return useQuery({
    queryKey: recruitmentKeys.readyToHire.queue(),
    queryFn: () => ReadyToHireService.listReadyToHire(),
  });
}

export function useConversionPreflight(applicationId?: string) {
  return useQuery({
    queryKey: recruitmentKeys.readyToHire.preflight(applicationId ?? ""),
    queryFn: () => ReadyToHireService.getPreflight(applicationId!),
    enabled: Boolean(applicationId),
  });
}

export function useConvertCandidate(applicationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: ConvertCandidateDto) =>
      ReadyToHireService.convert(applicationId, dto),
    onSuccess: (result) => {
      invalidateConversionQueries(queryClient, applicationId);
      if (result.isExistingConversion) {
        toast.message("This candidate was already converted — existing record reused.");
      } else {
        toast.success("Candidate converted to employee.");
      }
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, "Unable to convert candidate."));
    },
  });
}

export function useRetryConversionInvitation(applicationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<RetryConversionInvitationInput, "applicationId">) =>
      ReadyToHireService.retryInvitation({ ...input, applicationId }),
    onSuccess: () => {
      invalidateConversionQueries(queryClient, applicationId);
      toast.success("Invitation email retry requested.");
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, "Unable to resend invitation."));
    },
  });
}
