import { apiClient } from "@/services/api-client";

import type {
  Branch,
  CreateBranchDto,
  UpdateBranchDto,
} from "../types/branch";

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

type WorkingDaysPayload = {
  branch: {
    id: string;
    branchName: string;
    timezone: string | null;
    workingCalendarReviewedAt: string | null;
  } | null;
  days: Array<{
    id: string | null;
    branchId: string;
    dayOfWeek: number;
    isWorkingDay: boolean;
  }>;
  needsReview: boolean;
};

export class BranchService {
  static async getBranches(companyId?: string) {
    const response = await apiClient.get<ApiResponse<Branch[]>>("/branches", {
      params: companyId ? { companyId } : undefined,
    });

    return response.data.data;
  }

  static async getBranch(id: string) {
    const response = await apiClient.get<ApiResponse<Branch>>(
      `/branches/${id}`,
    );

    return response.data.data;
  }

  static async create(dto: CreateBranchDto) {
    const response = await apiClient.post<ApiResponse<Branch>>(
      "/branches",
      dto,
    );

    return response.data.data;
  }

  static async update(id: string, dto: UpdateBranchDto) {
    const response = await apiClient.patch<ApiResponse<Branch>>(
      `/branches/${id}`,
      dto,
    );

    return response.data.data;
  }

  static async delete(id: string) {
    await apiClient.delete(`/branches/${id}`);
  }

  static async getWorkingDays(branchId: string) {
    const response = await apiClient.get<ApiResponse<WorkingDaysPayload>>(
      `/branches/${branchId}/working-days`,
    );
    return response.data.data;
  }

  static async replaceWorkingDays(
    branchId: string,
    payload: {
      days: Array<{ dayOfWeek: number; isWorkingDay: boolean }>;
      markReviewed: boolean;
    },
  ) {
    const response = await apiClient.put<ApiResponse<WorkingDaysPayload>>(
      `/branches/${branchId}/working-days`,
      payload,
    );
    return response.data.data;
  }
}
