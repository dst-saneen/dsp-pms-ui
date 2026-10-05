"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getApiErrorCode, getApiErrorMessage } from "@/services/api-client";

import { recruitmentKeys } from "../../hooks/query-keys";
import { OfferResponseService } from "../services/offer-response-service";
import type { DeclineOfferInput, OfferResponseInput } from "../types/offer-response";

function getResponseErrorMessage(error: unknown, fallback: string) {
  const code = getApiErrorCode(error);
  if (
    code === "SIGNED_OFFER_STATE_CHANGED" ||
    code === "STALE_STATE" ||
    (error instanceof Error && error.message === "STALE_STATE")
  ) {
    return "This offer was updated. Refresh the page and try again.";
  }

  if (error instanceof Error) {
    if (error.message === "OFFER_TOKEN_INVALID") {
      return "This offer link is invalid or has already been used.";
    }
    if (error.message === "OFFER_NOT_RESPONDABLE") {
      return "This offer can no longer be accepted or declined.";
    }
    if (error.message === "STALE_STATE") {
      return "This offer was updated. Refresh the page and try again.";
    }
    if (error.message === "LEGAL_NAME_REQUIRED") {
      return "Enter your full legal name to continue.";
    }
    if (error.message === "ACKNOWLEDGEMENT_REQUIRED") {
      return "Acknowledgement is required to continue.";
    }
  }

  return getApiErrorMessage(error, fallback);
}

export function useOfferResponseInspection(token?: string) {
  return useQuery({
    queryKey: recruitmentKeys.offerResponse.inspect(token ?? ""),
    queryFn: () => OfferResponseService.inspect(token!),
    enabled: Boolean(token?.trim()),
    retry: false,
  });
}

export function useAcceptOffer(token: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: OfferResponseInput) =>
      OfferResponseService.accept(token, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: recruitmentKeys.offerResponse.inspect(token),
      });
      void queryClient.invalidateQueries({
        queryKey: recruitmentKeys.offers.all(),
      });
      void queryClient.invalidateQueries({
        queryKey: recruitmentKeys.applications.all(),
      });
    },
  });
}

export function useDeclineOffer(token: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: DeclineOfferInput) =>
      OfferResponseService.decline(token, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: recruitmentKeys.offerResponse.inspect(token),
      });
      void queryClient.invalidateQueries({
        queryKey: recruitmentKeys.offers.all(),
      });
      void queryClient.invalidateQueries({
        queryKey: recruitmentKeys.applications.all(),
      });
    },
  });
}

export { getResponseErrorMessage };
