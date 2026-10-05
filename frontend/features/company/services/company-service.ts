import { apiClient } from "@/services/api-client";

import type {
  Company,
  CompanyModuleEntitlementsResponse,
  CreateCompanyDto,
  UpdateCompanyModuleEntitlementsDto,
  UpdateCompanyDto,
} from "../types/company";

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export class CompanyService {
  static async getAll() {
    const response =
      await apiClient.get<ApiResponse<Company[]>>(
        "/companies",
      );

    return response.data.data;
  }

  static async getById(id: string) {
    const response =
      await apiClient.get<ApiResponse<Company>>(
        `/companies/${id}`,
      );

    return response.data.data;
  }

  static async create(
    dto: CreateCompanyDto,
  ) {
    const response =
      await apiClient.post<ApiResponse<Company>>(
        "/companies",
        dto,
      );

    return response.data.data;
  }

  static async update(
    id: string,
    dto: UpdateCompanyDto,
  ) {
    const response =
      await apiClient.patch<ApiResponse<Company>>(
        `/companies/${id}`,
        dto,
      );

    return response.data.data;
  }

  static async delete(id: string) {
    await apiClient.delete(
      `/companies/${id}`,
    );
  }

  static async getModuleEntitlements(id: string) {
    const response =
      await apiClient.get<ApiResponse<CompanyModuleEntitlementsResponse>>(
        `/companies/${id}/module-entitlements`,
      );

    return response.data.data;
  }

  static async updateModuleEntitlements(
    id: string,
    dto: UpdateCompanyModuleEntitlementsDto,
  ) {
    const response =
      await apiClient.patch<ApiResponse<CompanyModuleEntitlementsResponse>>(
        `/companies/${id}/module-entitlements`,
        dto,
      );

    return response.data.data;
  }
}
