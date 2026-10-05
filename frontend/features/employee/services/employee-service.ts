import { apiClient } from "@/services/api-client";
import { isRecruitmentMockEnabled } from "@/features/recruitment/constants/feature-flags";
import { ReadyToHireMockStore } from "@/features/recruitment/ready-to-hire/mocks/ready-to-hire-mock-store";

import type { ApiResponse } from "@/types/api-response";

import type { Employee } from "../types/employee";
import type { CreateEmployee } from "../types/create-employee";
import type { UpdateEmployee } from "../types/update-employee";
import type { EmployeeSummary } from "../types/employee-summary";

import type {
  EmployeePagedResult,
  EmployeeSearchParams,
} from "../types/employee-search";

function normalizeEmployeePayload(data: CreateEmployee | UpdateEmployee) {
  return Object.fromEntries(
    Object.entries(data).filter(
      ([, value]) => value !== "" && value !== null && value !== undefined,
    ),
  );
}

function toQueryParams(params?: EmployeeSearchParams) {
  if (!params) return undefined;
  return {
    ...params,
    isActive:
      typeof params.isActive === "boolean"
        ? params.isActive
          ? "true"
          : "false"
        : params.isActive,
  };
}

export const EmployeeService = {
  async search(
    params?: EmployeeSearchParams,
  ): Promise<EmployeePagedResult<Employee>> {
    const response = await apiClient.get<
      ApiResponse<EmployeePagedResult<Employee>>
    >("/employees", {
      params: toQueryParams(params),
    });
    return response.data.data;
  },

  /** Convenience for dropdowns — first page up to max page size. */
  async getAll(params?: EmployeeSearchParams): Promise<Employee[]> {
    const result = await this.search({
      ...params,
      page: params?.page ?? 1,
      limit: params?.limit ?? 100,
    });
    return result.items;
  },

  async getById(id: string): Promise<Employee> {
    if (isRecruitmentMockEnabled()) {
      const mockEmployee = ReadyToHireMockStore.getEmployee(id);
      if (mockEmployee) return mockEmployee;
    }

    const response = await apiClient.get<ApiResponse<Employee>>(
      `/employees/${id}`,
    );

    return response.data.data;
  },

  async create(data: CreateEmployee) {
    const payload = normalizeEmployeePayload(data);

    const response = await apiClient.post<ApiResponse<Employee>>(
      "/employees",
      payload,
    );

    return response.data.data;
  },

  async update(id: string, data: UpdateEmployee) {
    const payload = normalizeEmployeePayload(data);

    const response = await apiClient.patch<ApiResponse<Employee>>(
      `/employees/${id}`,
      payload,
    );

    return response.data.data;
  },

  async deactivate(id: string) {
    const response = await apiClient.patch<ApiResponse<Employee>>(
      `/employees/${id}/deactivate`,
    );

    return response.data.data;
  },

  async summary(): Promise<EmployeeSummary[]> {
    const response = await apiClient.get<ApiResponse<EmployeeSummary[]>>(
      "/employees/summary",
    );

    return response.data.data;
  },
};
