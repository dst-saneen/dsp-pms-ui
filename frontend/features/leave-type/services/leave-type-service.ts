import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api";

import type {
  CreateLeaveTypeDto,
  LeaveType,
  UpdateLeaveTypeDto,
} from "../types/leave-type";

export class LeaveTypeService {
  static async getAll(companyId?: string) {
    const response = await apiClient.get<ApiResponse<LeaveType[]>>(
      "/leave-types",
      {
        params: companyId ? { companyId } : undefined,
      },
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async create(dto: CreateLeaveTypeDto) {
    const response = await apiClient.post<ApiResponse<LeaveType>>(
      "/leave-types",
      dto,
    );
    return unwrapApiData(response.data);
  }

  static async update(id: string, dto: UpdateLeaveTypeDto) {
    const response = await apiClient.patch<ApiResponse<LeaveType>>(
      `/leave-types/${id}`,
      dto,
    );
    return unwrapApiData(response.data);
  }

  static async delete(id: string) {
    await apiClient.delete(`/leave-types/${id}`);
  }
}
