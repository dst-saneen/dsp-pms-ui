"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/services/api-client";

import { recruitmentKeys } from "../../hooks/query-keys";
import { OfferService } from "../services/offer-service";
import type {
  CreateOfferDraftDto,
  JobOfferSearch,
  RetryOfferDeliveryDto,
  RevokeOfferDto,
  SendOfferDto,
  UpdateOfferDraftDto,
} from "../types/job-offer";
import { isOfferDeliveryFailed, isOfferDeliveryPending } from "../utils/offer-delivery";

function getMutationErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    if (error.message === "STALE_STATE") {
      return "This offer was updated elsewhere. Refresh and try again.";
    }
    if (error.message === "INVALID_TRANSITION") {
      return "This action is not allowed for the current offer status.";
    }
    if (error.message === "OFFER_IMMUTABLE") {
      return "Sent offers cannot be edited. Create a revised version instead.";
    }
    if (error.message === "HEADCOUNT_NOT_AVAILABLE") {
      return "No headcount is available to reserve for this offer.";
    }
    if (error.message === "DRAFT_ALREADY_EXISTS") {
      return "A draft offer already exists for this application.";
    }
    if (error.message === "ACTIONABLE_OFFER_EXISTS") {
      return "An actionable sent offer already exists for this application.";
    }
    if (error.message === "INVALID_COMPENSATION") {
      return "Compensation must be greater than zero before sending.";
    }
    if (error.message === "REASON_REQUIRED") {
      return "A reason is required for this action.";
    }
    if (error.message === "DELIVERY_NOT_FAILED") {
      return "Delivery retry is only available after a failed send.";
    }
    if (error.message === "DELIVERY_IN_PROGRESS") {
      return "Offer email delivery is still in progress.";
    }
  }

  return getApiErrorMessage(error, fallback);
}

function invalidateOfferQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  applicationId?: string
) {
  void queryClient.invalidateQueries({
    queryKey: recruitmentKeys.offers.all(),
  });
  void queryClient.invalidateQueries({
    queryKey: recruitmentKeys.applications.all(),
  });
  void queryClient.invalidateQueries({
    queryKey: recruitmentKeys.openings.all(),
  });

  if (applicationId) {
    void queryClient.invalidateQueries({
      queryKey: recruitmentKeys.offers.byApplication(applicationId),
    });
    void queryClient.invalidateQueries({
      queryKey: recruitmentKeys.applications.detail(applicationId),
    });
  }
}

export function useOffers(filters?: JobOfferSearch) {
  return useQuery({
    queryKey: recruitmentKeys.offers.list(filters),
    queryFn: () => OfferService.getAll(filters),
  });
}

export function useApplicationOffers(applicationId?: string) {
  return useQuery({
    queryKey: recruitmentKeys.offers.byApplication(applicationId ?? ""),
    queryFn: () => OfferService.getByApplication(applicationId!),
    enabled: Boolean(applicationId),
  });
}

export function useCreateOfferDraft(applicationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data?: CreateOfferDraftDto) => OfferService.createDraft(applicationId, data),
    onSuccess: (offer) => {
      invalidateOfferQueries(queryClient, offer.jobApplicationId);
      toast.success("Offer draft created.");
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, "Unable to create offer draft."));
    },
  });
}

export function useUpdateOfferDraft(applicationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOfferDraftDto }) =>
      OfferService.updateDraft(id, data, applicationId),
    onSuccess: (offer) => {
      invalidateOfferQueries(queryClient, applicationId);
      toast.success("Offer draft saved.");
      return offer;
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, "Unable to save offer draft."));
    },
  });
}

export function useSendOffer(applicationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SendOfferDto }) =>
      OfferService.send(id, data, applicationId),
    onSuccess: (offer) => {
      invalidateOfferQueries(queryClient, applicationId);
      toast.success(
        isOfferDeliveryFailed(offer.delivery.status)
          ? "Offer sent but email delivery failed. Use Retry delivery on the offer detail page."
          : isOfferDeliveryPending(offer.delivery.status)
            ? "Offer queued for email delivery. Delivery status will update when the send completes."
            : "Offer sent. The candidate must accept from the email link."
      );
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, "Unable to send offer."));
    },
  });
}

export function useRetryOfferDelivery(applicationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RetryOfferDeliveryDto }) =>
      OfferService.retryDelivery(id, data, applicationId),
    onSuccess: (offer) => {
      invalidateOfferQueries(queryClient, applicationId);
      toast.success(
        isOfferDeliveryPending(offer.delivery.status)
          ? "Offer email retry queued. Refresh for the latest persisted delivery status."
          : isOfferDeliveryFailed(offer.delivery.status)
            ? "Retry was requested but delivery is still failed."
            : "Offer email delivery retried."
      );
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, "Unable to retry delivery."));
    },
  });
}

export function useRevokeOffer(applicationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RevokeOfferDto }) =>
      OfferService.revoke(id, data, applicationId),
    onSuccess: () => {
      invalidateOfferQueries(queryClient, applicationId);
      toast.success("Offer revoked.");
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, "Unable to revoke offer."));
    },
  });
}

export function useReviseOffer(applicationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sourceOfferId: string) => OfferService.revise(sourceOfferId, applicationId),
    onSuccess: () => {
      invalidateOfferQueries(queryClient, applicationId);
      toast.success("Revised offer draft created.");
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, "Unable to create revised offer."));
    },
  });
}
