import { API_ENDPOINTS } from "@/config/api";
import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api";

import type { CompOffCredit, CompOffCreditFilters } from "./types";

export class CompOffService {
  static async getAll(filters?: CompOffCreditFilters) {
    const response = await apiClient.get<ApiResponse<CompOffCredit[]>>(
      API_ENDPOINTS.compOffCredits.list, { params: filters },
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }
  static async revoke(id: string, reason: string) {
    const response = await apiClient.post<ApiResponse<CompOffCredit>>(
      `${API_ENDPOINTS.compOffCredits.list}/${id}/revoke`, { reason },
    );
    return unwrapApiData(response.data);
  }
}
