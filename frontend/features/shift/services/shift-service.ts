import { apiClient } from "@/services/api-client";

import type {
  Shift,
} from "../types/shift";

import type { ShiftFormValues } from "../validation/shift-schema";

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export class ShiftService {
  static async getShifts(
    companyId?: string,
    isActive?: boolean,
    ) {
    const response =
        await apiClient.get<ApiResponse<Shift[]>>(
        "/shifts",
        {
            params: {
            ...(companyId && {
                companyId,
            }),
            ...(isActive !== undefined && {
                isActive,
            }),
            },
        },
        );

    return response.data.data;
    }

  static async create(
    dto: ShiftFormValues,
  ) {
    const response =
      await apiClient.post<ApiResponse<Shift>>(
        "/shifts",
        dto,
      );

    return response.data.data;
  }

  static async update(
    id: string,
    dto: ShiftFormValues,
  ) {
    const response =
      await apiClient.patch<ApiResponse<Shift>>(
        `/shifts/${id}`,
        dto,
      );

    return response.data.data;
  }

  static async delete(id: string) {
    await apiClient.delete(
      `/shifts/${id}`,
    );
  }
}