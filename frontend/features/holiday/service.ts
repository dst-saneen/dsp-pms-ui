import { API_ENDPOINTS } from "@/config/api";
import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api";
import type {
  Holiday,
  HolidayDirectoryItem,
  HolidayPayload,
  HolidaySourceResponse,
} from "./types";

export class HolidayService {
  static async getAll(filters?: {
    companyId?: string;
    branchId?: string;
    year?: number;
  }) {
    const response = await apiClient.get<ApiResponse<Holiday[]>>(
      API_ENDPOINTS.holidays.list,
      { params: filters },
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async getDirectory(filters?: {
    companyId?: string;
    branchId?: string;
    year?: number;
  }) {
    const response = await apiClient.get<ApiResponse<HolidayDirectoryItem[]>>(
      API_ENDPOINTS.holidays.directory,
      { params: filters },
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async getSources() {
    const response = await apiClient.get<ApiResponse<HolidaySourceResponse>>(
      API_ENDPOINTS.holidays.source,
    );
    return unwrapApiData(response.data);
  }
  static async create(data: HolidayPayload) {
    const response = await apiClient.post<ApiResponse<Holiday>>(
      API_ENDPOINTS.holidays.list,
      data,
    );
    return unwrapApiData(response.data);
  }
  static async update(id: string, data: Partial<HolidayPayload>) {
    const response = await apiClient.patch<ApiResponse<Holiday>>(
      `${API_ENDPOINTS.holidays.list}/${id}`,
      data,
    );
    return unwrapApiData(response.data);
  }
  static async remove(id: string) {
    await apiClient.delete(`${API_ENDPOINTS.holidays.list}/${id}`);
  }
}
