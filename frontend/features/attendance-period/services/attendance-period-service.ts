import { API_ENDPOINTS } from "@/config/api";
import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api";

import type {
  AttendancePeriod,
  AttendancePeriodAction,
  AttendancePeriodFilters,
  AttendancePeriodTransitionInput,
  CreateAttendancePeriodInput,
} from "../types";

export const AttendancePeriodService = {
  async list(filters?: AttendancePeriodFilters) {
    const response = await apiClient.get<ApiResponse<AttendancePeriod[]>>(
      API_ENDPOINTS.attendancePeriods.list,
      { params: filters },
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  },

  async create(input: CreateAttendancePeriodInput) {
    const response = await apiClient.post<ApiResponse<AttendancePeriod>>(
      API_ENDPOINTS.attendancePeriods.list,
      input,
    );
    return unwrapApiData(response.data);
  },

  async transition(
    id: string,
    action: AttendancePeriodAction,
    input: AttendancePeriodTransitionInput,
  ) {
    const response = await apiClient.post<ApiResponse<AttendancePeriod>>(
      `${API_ENDPOINTS.attendancePeriods.list}/${id}/${action}`,
      input,
    );
    return unwrapApiData(response.data);
  },
};
