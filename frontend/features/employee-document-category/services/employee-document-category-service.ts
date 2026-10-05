import { apiClient } from "@/services/api-client";

import type { EmployeeDocumentCategory } from "../types/employee-document-category";
import type { CreateEmployeeDocumentCategory } from "../types/create-employee-document-category";
import type { UpdateEmployeeDocumentCategory } from "../types/update-employee-document-category";
import type { EmployeeDocumentCategorySearch } from "../types/employee-document-category-search";

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export class EmployeeDocumentCategoryService {
  static async getEmployeeDocumentCategories(
    params?: EmployeeDocumentCategorySearch,
  ): Promise<EmployeeDocumentCategory[]> {
    const response =
      await apiClient.get<
        ApiResponse<EmployeeDocumentCategory[]>
      >("/employee-document-categories", {
        params,
      });

    return response.data.data;
  }

  static async getEmployeeDocumentCategory(
    id: string,
  ): Promise<EmployeeDocumentCategory> {
    const response =
      await apiClient.get<
        ApiResponse<EmployeeDocumentCategory>
      >(`/employee-document-categories/${id}`);

    return response.data.data;
  }

  static async create(
    dto: CreateEmployeeDocumentCategory,
  ): Promise<EmployeeDocumentCategory> {
    const response =
      await apiClient.post<
        ApiResponse<EmployeeDocumentCategory>
      >("/employee-document-categories", dto);

    return response.data.data;
  }

  static async update(
    id: string,
    dto: UpdateEmployeeDocumentCategory,
  ): Promise<EmployeeDocumentCategory> {
    const response =
      await apiClient.patch<
        ApiResponse<EmployeeDocumentCategory>
      >(
        `/employee-document-categories/${id}`,
        dto,
      );

    return response.data.data;
  }

  static async delete(id: string): Promise<void> {
    await apiClient.delete(
      `/employee-document-categories/${id}`,
    );
  }
}