import { apiClient } from "@/services/api-client";

import type {
  Designation,
  CreateDesignationDto,
  UpdateDesignationDto,
} from "../types/designation";

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export class DesignationService {
  static async getDesignations(
    companyId?: string,
  ) {
    const response =
      await apiClient.get<ApiResponse<Designation[]>>(
        "/designations",
        {
          params: companyId
            ? { companyId }
            : undefined,
        },
      );

    return response.data.data;
  }

  static async getDesignation(id: string) {
    const response =
      await apiClient.get<ApiResponse<Designation>>(
        `/designations/${id}`,
      );

    return response.data.data;
  }

  static async create(
    dto: CreateDesignationDto,
  ) {
    const response =
      await apiClient.post<ApiResponse<Designation>>(
        "/designations",
        dto,
      );

    return response.data.data;
  }

  static async update(
    id: string,
    dto: UpdateDesignationDto,
  ) {
    const response =
      await apiClient.patch<ApiResponse<Designation>>(
        `/designations/${id}`,
        dto,
      );

    return response.data.data;
  }

  static async delete(id: string) {
    await apiClient.delete(
      `/designations/${id}`,
    );
  }
}