import { apiClient } from "@/services/api-client";

import type {
  Department,
  CreateDepartmentDto,
  UpdateDepartmentDto,
} from "../types/department";

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export class DepartmentService {
  static async getDepartments(branchId?: string, companyId?: string) {
    const response = await apiClient.get<ApiResponse<Department[]>>(
      "/departments",
      {
        params: {
          ...(branchId ? { branchId } : {}),
          ...(companyId ? { companyId } : {}),
        },
      },
    );

    return response.data.data;
  }

  static async getDepartment(id: string) {
    const response = await apiClient.get<ApiResponse<Department>>(
      `/departments/${id}`,
    );

    return response.data.data;
  }

  static async create(dto: CreateDepartmentDto) {
    const response = await apiClient.post<ApiResponse<Department>>(
      "/departments",
      dto,
    );

    return response.data.data;
  }

  static async update(id: string, dto: UpdateDepartmentDto) {
    const response = await apiClient.patch<ApiResponse<Department>>(
      `/departments/${id}`,
      dto,
    );

    return response.data.data;
  }

  static async delete(id: string) {
    await apiClient.delete(`/departments/${id}`);
  }
}
