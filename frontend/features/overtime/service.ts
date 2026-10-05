import { API_ENDPOINTS } from "@/config/api";
import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api";

import type {
  ApproveOvertimeDto,
  OvertimeRequest,
  OvertimeRequestFilters,
} from "./types";

export class OvertimeService {
  static async getAll(filters?: OvertimeRequestFilters) {
    const response = await apiClient.get<ApiResponse<OvertimeRequest[]>>(
      API_ENDPOINTS.overtimeRequests.list,
      { params: filters },
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async approve(id: string, data: ApproveOvertimeDto) {
    const response = await apiClient.post<ApiResponse<OvertimeRequest>>(
      `${API_ENDPOINTS.overtimeRequests.list}/${id}/approve`,
      data,
    );
    return unwrapApiData(response.data);
  }

  static async reject(id: string, remarks: string) {
    const response = await apiClient.post<ApiResponse<OvertimeRequest>>(
      `${API_ENDPOINTS.overtimeRequests.list}/${id}/reject`,
      { remarks },
    );
    return unwrapApiData(response.data);
  }

  static async cancel(id: string, reason?: string) {
    const response = await apiClient.post<ApiResponse<OvertimeRequest>>(
      `${API_ENDPOINTS.overtimeRequests.list}/${id}/cancel`,
      { reason },
    );
    return unwrapApiData(response.data);
  }
}
