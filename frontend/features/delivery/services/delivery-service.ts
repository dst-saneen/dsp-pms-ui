"use client";

import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api";
import type {
  DeliveryAttempt,
  DeliveryCommandBody,
  DeliveryHealthResponse,
  DeliveryMessage,
  EmailSuppression,
  ListDeliveryMessagesParams,
  PaginatedResult,
  RecipientException,
} from "../types/delivery";

const BASE = "/delivery";

function normalizePage<T>(raw: PaginatedResult<T>): PaginatedResult<T> {
  const items = raw.items ?? raw.data ?? [];
  return {
    items,
    total: raw.total ?? items.length,
    page: raw.page ?? 1,
    limit: raw.limit ?? items.length,
  };
}

export const DeliveryService = {
  async listMessages(
    params: ListDeliveryMessagesParams = {},
  ): Promise<PaginatedResult<DeliveryMessage>> {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.channel) query.set("channel", params.channel);
    if (params.eventType) query.set("eventType", params.eventType);
    if (params.keyword) query.set("keyword", params.keyword);
    if (params.companyId) query.set("companyId", params.companyId);
    if (params.branchId) query.set("branchId", params.branchId);
    if (params.recipientId) query.set("recipientId", params.recipientId);
    if (params.fromDate) query.set("fromDate", params.fromDate);
    if (params.toDate) query.set("toDate", params.toDate);
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    if (params.sortBy) query.set("sortBy", params.sortBy);
    if (params.sortOrder) query.set("sortOrder", params.sortOrder);

    const url = query.toString()
      ? `${BASE}/messages?${query.toString()}`
      : `${BASE}/messages`;

    const res = await apiClient.get<ApiResponse<PaginatedResult<DeliveryMessage>>>(url);
    return normalizePage(unwrapApiData(res.data));
  },

  async getMessage(id: string): Promise<DeliveryMessage> {
    const res = await apiClient.get<ApiResponse<DeliveryMessage>>(
      `${BASE}/messages/${id}`,
    );
    return unwrapApiData(res.data);
  },

  async getAttempts(id: string): Promise<DeliveryAttempt[]> {
    const res = await apiClient.get<ApiResponse<DeliveryAttempt[]>>(
      `${BASE}/messages/${id}/attempts`,
    );
    return unwrapApiData(res.data);
  },

  async listDeadLetters(
    params: Pick<ListDeliveryMessagesParams, "page" | "limit" | "companyId" | "branchId"> = {},
  ): Promise<PaginatedResult<DeliveryMessage>> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    if (params.companyId) query.set("companyId", params.companyId);
    if (params.branchId) query.set("branchId", params.branchId);
    const url = query.toString()
      ? `${BASE}/dead-letters?${query.toString()}`
      : `${BASE}/dead-letters`;
    const res = await apiClient.get<ApiResponse<PaginatedResult<DeliveryMessage>>>(url);
    return normalizePage(unwrapApiData(res.data));
  },

  async listSuppressions(
    params: Pick<ListDeliveryMessagesParams, "page" | "limit"> = {},
  ): Promise<PaginatedResult<EmailSuppression>> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    const url = query.toString()
      ? `${BASE}/suppressions?${query.toString()}`
      : `${BASE}/suppressions`;
    const res = await apiClient.get<ApiResponse<PaginatedResult<EmailSuppression>>>(url);
    return normalizePage(unwrapApiData(res.data));
  },

  async retry(id: string, body: DeliveryCommandBody): Promise<DeliveryMessage> {
    const res = await apiClient.post<ApiResponse<DeliveryMessage>>(
      `${BASE}/messages/${id}/retry`,
      body,
    );
    return unwrapApiData(res.data);
  },

  async cancel(id: string, body: DeliveryCommandBody): Promise<DeliveryMessage | null> {
    const res = await apiClient.post<ApiResponse<DeliveryMessage>>(
      `${BASE}/messages/${id}/cancel`,
      body,
    );
    return unwrapApiData(res.data);
  },

  async releaseSuppression(id: string, body: DeliveryCommandBody): Promise<void> {
    await apiClient.post(`${BASE}/suppressions/${id}/release`, body);
  },

  async listRecipientExceptions(
    params: Pick<ListDeliveryMessagesParams, "page" | "limit"> = {},
  ): Promise<PaginatedResult<RecipientException>> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    const url = query.toString()
      ? `${BASE}/recipient-exceptions?${query.toString()}`
      : `${BASE}/recipient-exceptions`;
    const res = await apiClient.get<ApiResponse<PaginatedResult<RecipientException>>>(
      url,
    );
    return normalizePage(unwrapApiData(res.data));
  },

  async resolveRecipientException(
    id: string,
    body: DeliveryCommandBody,
  ): Promise<void> {
    await apiClient.post(`${BASE}/recipient-exceptions/${id}/resolve`, body);
  },

  async getHealth(): Promise<DeliveryHealthResponse> {
    const res = await apiClient.get<ApiResponse<DeliveryHealthResponse>>(
      `${BASE}/health`,
    );
    return unwrapApiData(res.data);
  },
};
