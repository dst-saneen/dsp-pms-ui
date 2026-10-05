"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/services/api-client";
import { DeliveryService } from "../services/delivery-service";
import type {
  DeliveryCommandBody,
  ListDeliveryMessagesParams,
} from "../types/delivery";

const deliveryKeys = {
  all: ["delivery"] as const,
  messages: (params: ListDeliveryMessagesParams) =>
    ["delivery", "messages", params] as const,
  message: (id: string) => ["delivery", "message", id] as const,
  attempts: (id: string) => ["delivery", "attempts", id] as const,
  deadLetters: (params: object) => ["delivery", "dead-letters", params] as const,
  suppressions: (params: object) => ["delivery", "suppressions", params] as const,
  recipientExceptions: (params: object) =>
    ["delivery", "recipient-exceptions", params] as const,
  health: ["delivery", "health"] as const,
};

export function useDeliveryMessages(params: ListDeliveryMessagesParams = {}) {
  return useQuery({
    queryKey: deliveryKeys.messages(params),
    queryFn: () => DeliveryService.listMessages(params),
  });
}

export function useDeliveryMessage(id: string) {
  return useQuery({
    queryKey: deliveryKeys.message(id),
    queryFn: () => DeliveryService.getMessage(id),
    enabled: Boolean(id),
  });
}

export function useDeliveryAttempts(id: string) {
  return useQuery({
    queryKey: deliveryKeys.attempts(id),
    queryFn: () => DeliveryService.getAttempts(id),
    enabled: Boolean(id),
  });
}

export function useDeadLetters(
  params: Pick<ListDeliveryMessagesParams, "page" | "limit"> = {},
) {
  return useQuery({
    queryKey: deliveryKeys.deadLetters(params),
    queryFn: () => DeliveryService.listDeadLetters(params),
  });
}

export function useSuppressions(
  params: Pick<ListDeliveryMessagesParams, "page" | "limit"> = {},
) {
  return useQuery({
    queryKey: deliveryKeys.suppressions(params),
    queryFn: () => DeliveryService.listSuppressions(params),
  });
}

export function useRecipientExceptions(
  params: Pick<ListDeliveryMessagesParams, "page" | "limit"> = {},
) {
  return useQuery({
    queryKey: deliveryKeys.recipientExceptions(params),
    queryFn: () => DeliveryService.listRecipientExceptions(params),
  });
}

export function useResolveRecipientException() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      reason,
      expectedVersion,
    }: {
      id: string;
      reason: string;
      expectedVersion: number;
    }) =>
      DeliveryService.resolveRecipientException(id, {
        expectedVersion,
        operationId: crypto.randomUUID(),
        reason,
      }),
    onSuccess: () => {
      toast.success("Recipient exception resolved.");
      void queryClient.invalidateQueries({ queryKey: deliveryKeys.all });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to resolve recipient exception."));
    },
  });
}

export function useDeliveryHealth() {
  return useQuery({
    queryKey: deliveryKeys.health,
    queryFn: () => DeliveryService.getHealth(),
    refetchInterval: 30_000,
  });
}

export function useRetryDelivery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      expectedVersion,
      reason,
    }: {
      id: string;
      expectedVersion: number;
      reason: string;
    }) => {
      const body: DeliveryCommandBody = {
        expectedVersion,
        operationId: crypto.randomUUID(),
        reason,
      };
      return DeliveryService.retry(id, body);
    },
    onSuccess: (_data, { id }) => {
      toast.success("Message queued for retry.");
      void queryClient.invalidateQueries({ queryKey: deliveryKeys.message(id) });
      void queryClient.invalidateQueries({ queryKey: deliveryKeys.all });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to retry message."));
    },
  });
}

export function useCancelDelivery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      expectedVersion,
      reason,
    }: {
      id: string;
      expectedVersion: number;
      reason: string;
    }) => {
      const body: DeliveryCommandBody = {
        expectedVersion,
        operationId: crypto.randomUUID(),
        reason,
      };
      return DeliveryService.cancel(id, body);
    },
    onSuccess: (_data, { id }) => {
      toast.success("Message cancelled.");
      void queryClient.invalidateQueries({ queryKey: deliveryKeys.message(id) });
      void queryClient.invalidateQueries({ queryKey: deliveryKeys.all });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to cancel message."));
    },
  });
}

export function useReleaseSuppression() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      reason,
      expectedVersion,
    }: {
      id: string;
      reason: string;
      expectedVersion: number;
    }) =>
      DeliveryService.releaseSuppression(id, {
        expectedVersion,
        operationId: crypto.randomUUID(),
        reason,
      }),
    onSuccess: () => {
      toast.success("Suppression released.");
      void queryClient.invalidateQueries({ queryKey: deliveryKeys.all });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to release suppression."));
    },
  });
}
