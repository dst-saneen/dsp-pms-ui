import { API_ENDPOINTS } from "@/config/api";
import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api";
import type {
  WorkforceCalendarEmployeeOptionsResponse,
  WorkforceCalendarFilters,
  WorkforceCalendarResponse,
} from "./types";

export class WorkforceCalendarService {
  static async getCalendar(filters: WorkforceCalendarFilters) {
    const response = await apiClient.get<ApiResponse<WorkforceCalendarResponse>>(
      API_ENDPOINTS.workforceCalendar.list,
      { params: filters },
    );
    return unwrapApiData(response.data);
  }

  static async getTeamCalendar(
    filters: Pick<WorkforceCalendarFilters, "fromDate" | "toDate" | "employeeId">,
  ) {
    const response = await apiClient.get<ApiResponse<WorkforceCalendarResponse>>(
      API_ENDPOINTS.workforceCalendar.team,
      { params: filters },
    );
    return unwrapApiData(response.data);
  }

  static async getEmployeeOptions(filters: {
    branchId?: string;
    departmentId?: string;
    q?: string;
  }) {
    const response = await apiClient.get<
      ApiResponse<WorkforceCalendarEmployeeOptionsResponse>
    >(API_ENDPOINTS.workforceCalendar.employeeOptions, { params: filters });
    return unwrapApiData(response.data);
  }
}
