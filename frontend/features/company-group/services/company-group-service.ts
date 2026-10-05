import { apiClient } from "@/services/api-client";

import type {
  CompanyGroup,
  CreateCompanyGroupDto,
  UpdateCompanyGroupDto,
} from "../types/company-group";

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export class CompanyGroupService {
  static async getAll() {
    const response =
      await apiClient.get<ApiResponse<CompanyGroup[]>>(
        "/company-groups",
      );

    return response.data.data;
  }

  static async getById(id: string) {
    const response =
      await apiClient.get<ApiResponse<CompanyGroup>>(
        `/company-groups/${id}`,
      );

    return response.data.data;
  }

  static async create(
    dto: CreateCompanyGroupDto,
  ) {
    const response =
      await apiClient.post<ApiResponse<CompanyGroup>>(
        "/company-groups",
        dto,
      );

    return response.data.data;
  }

  static async update(
    id: string,
    dto: UpdateCompanyGroupDto,
  ) {
    const response =
      await apiClient.patch<ApiResponse<CompanyGroup>>(
        `/company-groups/${id}`,
        dto,
      );

    return response.data.data;
  }

  static async delete(id: string) {
    await apiClient.delete(
      `/company-groups/${id}`,
    );
  }
}