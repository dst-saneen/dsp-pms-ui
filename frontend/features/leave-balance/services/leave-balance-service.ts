import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api";

import type {
  EmployeeLeaveBalanceRow,
  GenerateLeaveBalancesInput,
  LeaveBalanceListFilters,
  LeaveBalanceGenerationResult,
} from "../types/leave-balance";

export class LeaveBalanceService {
  static async getAll(filters?: LeaveBalanceListFilters) {
    const response = await apiClient.get<ApiResponse<EmployeeLeaveBalanceRow[]>>(
      "/employee-leave-balances",
      { params: filters },
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async generate(input: GenerateLeaveBalancesInput) {
    const response = await apiClient.post<
      ApiResponse<LeaveBalanceGenerationResult>
    >("/employee-leave-balances/generate", input);
    return unwrapApiData(response.data);
  }
}
