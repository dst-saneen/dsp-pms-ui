import { API_ENDPOINTS } from "@/config/api";
import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api";

import type {
  AttendanceException,
  AttendanceExceptionFilters,
  AttendanceRegularization,
  AttendanceRegularizationFilters,
} from "../types";

export const AttendanceExceptionService = {
  async listExceptions(filters?: AttendanceExceptionFilters) {
    const response = await apiClient.get<ApiResponse<AttendanceException[]>>(
      API_ENDPOINTS.attendance.exceptions,
      { params: filters }
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  },

  async listRegularizations(filters?: AttendanceRegularizationFilters) {
    const response = await apiClient.get<ApiResponse<AttendanceRegularization[]>>(
      API_ENDPOINTS.attendance.regularizations,
      { params: filters }
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  },

  async approveRegularization(id: string, remarks?: string) {
    const response = await apiClient.post<ApiResponse<AttendanceRegularization>>(
      `${API_ENDPOINTS.attendance.regularizations}/${id}/approve`,
      { remarks }
    );
    return unwrapApiData(response.data);
  },

  async rejectRegularization(id: string, remarks?: string) {
    const response = await apiClient.post<ApiResponse<AttendanceRegularization>>(
      `${API_ENDPOINTS.attendance.regularizations}/${id}/reject`,
      { remarks }
    );
    return unwrapApiData(response.data);
  },

  async cancelRegularization(id: string) {
    const response = await apiClient.post<ApiResponse<AttendanceRegularization>>(
      `${API_ENDPOINTS.attendance.regularizations}/${id}/cancel`,
      {}
    );
    return unwrapApiData(response.data);
  },

  async submitRegularization(input: {
    attendanceId: string;
    attendanceExceptionId?: string;
    proposedCheckInAt?: string;
    proposedCheckOutAt?: string;
    reason: string;
  }) {
    const response = await apiClient.post<ApiResponse<AttendanceRegularization>>(
      API_ENDPOINTS.attendance.regularizations,
      input
    );
    return unwrapApiData(response.data);
  },
};
