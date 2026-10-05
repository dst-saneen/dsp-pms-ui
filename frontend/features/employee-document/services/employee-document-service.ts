import { apiClient } from "@/services/api-client";

import type { ApiResponse } from "@/types/api-response";

import type { EmployeeDocument } from "../types/employee-document";
import type { EmployeeDocumentHistoryEntry } from "../types/employee-document";
import type { CreateEmployeeDocument } from "../types/create-employee-document";
import type { UpdateEmployeeDocument } from "../types/update-employee-document";
import type { EmployeeDocumentSummary } from "../types/employee-document-summary";

import type { EmployeeDocumentSearch } from "../types/employee-document-search";

function normalizeEmployeeDocumentPayload(
  data: CreateEmployeeDocument | UpdateEmployeeDocument,
) {
  return Object.fromEntries(
    Object.entries(data).filter(
      ([, value]) =>
        value !== "" &&
        value !== null &&
        value !== undefined,
    ),
  );
}

export const EmployeeDocumentService = {
  async getAll(
    params?: EmployeeDocumentSearch,
  ): Promise<EmployeeDocument[]> {
    const response =
      await apiClient.get<ApiResponse<EmployeeDocument[]>>(
        "/employee-documents",
        {
          params,
        },
      );

    return response.data.data;
  },

  async getById(
    id: string,
  ): Promise<EmployeeDocument> {
    const response =
      await apiClient.get<ApiResponse<EmployeeDocument>>(
        `/employee-documents/${id}`,
      );

    return response.data.data;
  },

  async create(
    data: CreateEmployeeDocument,
  ) {
    const payload =
      normalizeEmployeeDocumentPayload(data);

    const response =
      await apiClient.post<
        ApiResponse<EmployeeDocument>
      >("/employee-documents", payload);

    return response.data.data;
  },

  async update(
    id: string,
    data: UpdateEmployeeDocument,
  ) {
    const payload =
      normalizeEmployeeDocumentPayload(data);

    const response =
      await apiClient.patch<
        ApiResponse<EmployeeDocument>
      >(
        `/employee-documents/${id}`,
        payload,
      );

    return response.data.data;
  },

  async verify(
    id: string,
    remarks?: string,
  ) {
    const response =
      await apiClient.patch<
        ApiResponse<EmployeeDocument>
      >(
        `/employee-documents/${id}/verify`,
        {
          remarks,
        },
      );

    return response.data.data;
  },

  async reject(
    id: string,
    remarks: string,
  ) {
    const response =
      await apiClient.patch<
        ApiResponse<EmployeeDocument>
      >(
        `/employee-documents/${id}/reject`,
        {
          remarks,
        },
      );

    return response.data.data;
  },

  async resetVerification(
    id: string,
  ) {
    const response =
      await apiClient.patch<
        ApiResponse<EmployeeDocument>
      >(
        `/employee-documents/${id}/reset`,
      );

    return response.data.data;
  },

  async delete(id: string) {
    const response =
      await apiClient.delete<
        ApiResponse<void>
      >(`/employee-documents/${id}`);

    return response.data.data;
  },

  async getByEmployee(
    employeeId: string,
  ): Promise<EmployeeDocument[]> {
    const response =
      await apiClient.get<
        ApiResponse<EmployeeDocument[]>
      >(
        `/employee-documents/employee/${employeeId}`,
      );

    return response.data.data;
  },

  async summary(): Promise<EmployeeDocumentSummary> {
    const response =
      await apiClient.get<
        ApiResponse<EmployeeDocumentSummary>
      >("/employee-documents/summary");

    return response.data.data;
  },

  async employeeSummary(
    employeeId: string,
  ): Promise<EmployeeDocumentSummary> {
    const response =
      await apiClient.get<
        ApiResponse<EmployeeDocumentSummary>
      >(
        `/employee-documents/employee/${employeeId}/summary`,
      );

    return response.data.data;
  },

  async getHistory(id: string): Promise<EmployeeDocumentHistoryEntry[]> {
    const response = await apiClient.get<
      ApiResponse<EmployeeDocumentHistoryEntry[]>
    >(`/employee-documents/${id}/history`);

    return response.data.data;
  },
};