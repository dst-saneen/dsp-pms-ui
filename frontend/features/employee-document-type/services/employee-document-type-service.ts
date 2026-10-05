import { apiClient } from "@/services/api-client";

import type { ApiResponse } from "@/types/api-response";

import type { EmployeeDocumentType } from "../types/employee-document-type";
import type { CreateEmployeeDocumentType } from "../types/create-employee-document-type";
import type { UpdateEmployeeDocumentType } from "../types/update-employee-document-type";
import type { EmployeeDocumentTypeSearch } from "../types/employee-document-type-search";

function normalizePayload(
  data:
    | CreateEmployeeDocumentType
    | UpdateEmployeeDocumentType,
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

export const EmployeeDocumentTypeService = {
  async getAll(
    params?: EmployeeDocumentTypeSearch,
  ): Promise<EmployeeDocumentType[]> {
    const response =
      await apiClient.get<
        ApiResponse<EmployeeDocumentType[]>
      >("/employee-document-types", {
        params,
      });

    return response.data.data;
  },

  async getById(
    id: string,
  ): Promise<EmployeeDocumentType> {
    const response =
      await apiClient.get<
        ApiResponse<EmployeeDocumentType>
      >(`/employee-document-types/${id}`);

    return response.data.data;
  },

  async create(
    data: CreateEmployeeDocumentType,
  ) {
    const payload = normalizePayload(data);

    const response =
      await apiClient.post<
        ApiResponse<EmployeeDocumentType>
      >(
        "/employee-document-types",
        payload,
      );

    return response.data.data;
  },

  async update(
    id: string,
    data: UpdateEmployeeDocumentType,
  ) {
    const payload = normalizePayload(data);

    const response =
      await apiClient.patch<
        ApiResponse<EmployeeDocumentType>
      >(
        `/employee-document-types/${id}`,
        payload,
      );

    return response.data.data;
  },

  async delete(id: string) {
    await apiClient.delete(
      `/employee-document-types/${id}`,
    );
  },

  async summary() {
    const response =
      await apiClient.get<
        ApiResponse<{
          total: number;
          active: number;
          inactive: number;
        }>
      >(
        "/employee-document-types/summary",
      );

    return response.data.data;
  },
};