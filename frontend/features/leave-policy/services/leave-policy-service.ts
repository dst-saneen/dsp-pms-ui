import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api";

import type {
  CreateLeavePolicyDto,
  LeavePolicy,
  LeavePolicyMatrix,
  ReplaceLeavePolicyMatrixDto,
  UpdateLeavePolicyDto,
} from "../types/leave-policy";

export class LeavePolicyService {
  static async getAll(params?: {
    companyId?: string;
    branchId?: string;
    leaveTypeId?: string;
  }) {
    const response = await apiClient.get<ApiResponse<LeavePolicy[]>>(
      "/leave-policies",
      { params },
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async create(dto: CreateLeavePolicyDto) {
    const response = await apiClient.post<ApiResponse<LeavePolicy>>(
      "/leave-policies",
      dto,
    );
    return unwrapApiData(response.data);
  }

  static async update(id: string, dto: UpdateLeavePolicyDto) {
    const response = await apiClient.patch<ApiResponse<LeavePolicy>>(
      `/leave-policies/${id}`,
      dto,
    );
    return unwrapApiData(response.data);
  }

  /** Apply the same carry-forward limit to every policy in a leave-type × branch group. */
  static async updateCarryForwardForPolicies(
    policyIds: string[],
    carryForwardLimit: number,
  ) {
    const uniqueIds = Array.from(new Set(policyIds.filter(Boolean)));
    if (uniqueIds.length === 0) return [];
    return Promise.all(
      uniqueIds.map((id) => this.update(id, { carryForwardLimit })),
    );
  }

  static async delete(id: string) {
    await apiClient.delete(`/leave-policies/${id}`);
  }

  static async getMatrix(params: { branchId: string; departmentId?: string }) {
    const response = await apiClient.get<ApiResponse<LeavePolicyMatrix>>(
      "/leave-policies/matrix",
      { params },
    );
    return unwrapApiData(response.data);
  }

  static async replaceMatrix(dto: ReplaceLeavePolicyMatrixDto) {
    const response = await apiClient.put<ApiResponse<LeavePolicyMatrix>>(
      "/leave-policies/matrix",
      dto,
    );
    return unwrapApiData(response.data);
  }
}
