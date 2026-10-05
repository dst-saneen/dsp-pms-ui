import { apiClient, unwrapApiData } from "@/services/api-client";
import { API_ENDPOINTS } from "@/config/api";
import type { ApiResponse } from "@/types/api";

import type {
  AttendanceListResult,
  AttendanceRecord,
  CorrectAttendanceInput,
} from "../types/attendance";

export type AttendanceListParams = {
  employeeId?: string;
  companyId?: string;
  branchId?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export const AttendanceService = {
  async list(params?: AttendanceListParams): Promise<AttendanceListResult> {
    const response = await apiClient.get<
      ApiResponse<AttendanceListResult | AttendanceRecord[]>
    >(API_ENDPOINTS.attendance.list, { params });
    const data = unwrapApiData(response.data);
    if (Array.isArray(data)) {
      return {
        items: data,
        total: data.length,
        page: 1,
        pageSize: data.length || 50,
        totalPages: 1,
      };
    }
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      total: data?.total ?? 0,
      page: data?.page ?? 1,
      pageSize: data?.pageSize ?? 50,
      totalPages: data?.totalPages ?? 1,
    };
  },

  async correct(id: string, input: CorrectAttendanceInput) {
    const response = await apiClient.patch<ApiResponse<AttendanceRecord>>(
      `${API_ENDPOINTS.attendance.correct}/${id}/correct`,
      input,
    );
    return unwrapApiData(response.data);
  },
};
