import { apiClient } from "./api-client";
import { API_ENDPOINTS } from "@/config/api";

export const DashboardService = {
  async getPayrollSummary() {
    const { data } = await apiClient.get(
      API_ENDPOINTS.dashboard.payrollSummary
    );

    return data;
  },

  async getMonthlySummary() {
    const { data } = await apiClient.get(
      API_ENDPOINTS.dashboard.monthlySummary
    );

    return data;
  },
};