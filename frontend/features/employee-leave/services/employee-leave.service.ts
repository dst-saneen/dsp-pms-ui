import { apiClient } from "@/services/api-client";

import type { ApiResponse } from "@/types/api-response";

import type {
  EmployeeLeaveProfileModel,
  EmployeeLeaveSummary,
  EmployeeLeaveBalance,
  EmployeeLeaveHistory,
  EmployeeUpcomingLeave,
} from "../types";

export class EmployeeLeaveService {
  static async getProfile(
    employeeId: string,
    year?: number,
  ): Promise<EmployeeLeaveProfileModel> {
    const response =
      await apiClient.get<
        ApiResponse<EmployeeLeaveProfileModel>
      >(`/employee-leave/${employeeId}`, {
        params: {
          year,
        },
      });

    return response.data.data;
  }

  static async getSummary(
    employeeId: string,
    year?: number,
  ): Promise<EmployeeLeaveSummary> {
    const response =
      await apiClient.get<
        ApiResponse<EmployeeLeaveSummary>
      >(
        `/employees/${employeeId}/leave/summary`,
        {
          params: {
            year,
          },
        },
      );

    return response.data.data;
  }

  static async getBalances(
    employeeId: string,
    year?: number,
  ): Promise<EmployeeLeaveBalance[]> {
    const response =
      await apiClient.get<
        ApiResponse<EmployeeLeaveBalance[]>
      >(
        `/employees/${employeeId}/leave/balances`,
        {
          params: {
            year,
          },
        },
      );

    return response.data.data;
  }

  static async getHistory(
    employeeId: string,
  ): Promise<EmployeeLeaveHistory[]> {
    const response =
      await apiClient.get<
        ApiResponse<EmployeeLeaveHistory[]>
      >(
        `/employees/${employeeId}/leave/history`,
      );

    return response.data.data;
  }

  static async getUpcoming(
    employeeId: string,
  ): Promise<EmployeeUpcomingLeave[]> {
    const response =
      await apiClient.get<
        ApiResponse<EmployeeUpcomingLeave[]>
      >(
        `/employees/${employeeId}/leave/upcoming`,
      );

    return response.data.data;
  }
}