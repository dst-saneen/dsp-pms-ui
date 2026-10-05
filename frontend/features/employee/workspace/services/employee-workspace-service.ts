import { apiClient } from "@/services/api-client";

import { API_ENDPOINTS } from "@/config/api";

import type { ApiResponse } from "@/types/api-response";

import type { EmployeeWorkspace } from "../types/employee-workspace";

export const EmployeeWorkspaceService = {
  async getByEmployeeId(
    employeeId: string,
  ): Promise<EmployeeWorkspace> {
    const response =
      await apiClient.get<ApiResponse<EmployeeWorkspace>>(
        `${API_ENDPOINTS.employeeWorkspace.get}/${employeeId}`,
      );

    return response.data.data;
  },
};