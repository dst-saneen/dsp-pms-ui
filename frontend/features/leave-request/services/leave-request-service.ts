import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api";

import type {
  LeaveApprovalQueue,
  LeaveRequest,
  LeaveRequestFilters,
} from "../types/leave-request";

export class LeaveRequestService {
  static async getAll(filters?: LeaveRequestFilters) {
    const response = await apiClient.get<ApiResponse<LeaveRequest[]>>(
      "/leave-requests",
      { params: filters },
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async getPendingApprovals(queue: LeaveApprovalQueue = "actionable") {
    const response = await apiClient.get<ApiResponse<LeaveRequest[]>>(
      "/leave-requests/pending-approvals",
      { params: { queue } },
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async approve(id: string, remarks?: string) {
    const response = await apiClient.post(
      `/leave-requests/${id}/approve`,
      { remarks },
    );
    return unwrapApiData(response.data);
  }

  static async reject(id: string, remarks: string) {
    const response = await apiClient.post(`/leave-requests/${id}/reject`, {
      remarks,
    });
    return unwrapApiData(response.data);
  }

  static async cancel(id: string, reason?: string) {
    const response = await apiClient.post(`/leave-requests/${id}/cancel`, {
      reason,
    });
    return unwrapApiData(response.data);
  }
}
