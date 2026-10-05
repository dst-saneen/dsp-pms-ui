import { apiClient, unwrapApiData } from "@/services/api-client";
import { API_ENDPOINTS } from "@/config/api";
import type { ApiResponse } from "@/types/api";

import type { OptionalHolidayCatalog } from "./types";

export const OptionalHolidayService = {
  async getOptionalHolidays(year: number): Promise<OptionalHolidayCatalog> {
    const response = await apiClient.get<ApiResponse<OptionalHolidayCatalog>>(
      API_ENDPOINTS.me.optionalHolidays,
      { params: { year } }
    );
    return unwrapApiData(response.data);
  },

  async updateOptionalHolidaySelections(
    year: number,
    eventIds: string[]
  ): Promise<OptionalHolidayCatalog> {
    const response = await apiClient.put<ApiResponse<OptionalHolidayCatalog>>(
      API_ENDPOINTS.me.optionalHolidaySelections(year),
      { eventIds }
    );
    return unwrapApiData(response.data);
  },
};
