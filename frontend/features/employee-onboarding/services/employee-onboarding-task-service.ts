import { apiClient } from "@/services/api-client";

import type { ApiResponse } from "@/types/api-response";

import type { EmployeeOnboardingTask } from "../types/employee-onboarding-task";

export interface CompleteEmployeeOnboardingTaskDto {
  remarks?: string;
}

export interface StartEmployeeOnboardingTaskDto {
  remarks?: string;
}

export interface SkipEmployeeOnboardingTaskDto {
  reason: string;
}

export interface ReopenEmployeeOnboardingTaskDto {
  reason: string;
}

export class EmployeeOnboardingTaskService {
  static async start(
    id: string,
    dto: StartEmployeeOnboardingTaskDto = {},
  ): Promise<EmployeeOnboardingTask> {
    const response =
      await apiClient.post<
        ApiResponse<EmployeeOnboardingTask>
      >(
        `/employee-onboarding-task/${id}/start`,
        dto,
      );

    return response.data.data;
  }

  static async complete(
    id: string,
    dto: CompleteEmployeeOnboardingTaskDto = {},
  ): Promise<EmployeeOnboardingTask> {
    const response =
      await apiClient.post<
        ApiResponse<EmployeeOnboardingTask>
      >(
        `/employee-onboarding-task/${id}/complete`,
        dto,
      );

    return response.data.data;
  }

  static async skip(
    id: string,
    dto: SkipEmployeeOnboardingTaskDto,
  ): Promise<EmployeeOnboardingTask> {
    const response =
      await apiClient.post<
        ApiResponse<EmployeeOnboardingTask>
      >(
        `/employee-onboarding-task/${id}/skip`,
        dto,
      );

    return response.data.data;
  }

  static async reopen(
    id: string,
    dto: ReopenEmployeeOnboardingTaskDto,
  ): Promise<EmployeeOnboardingTask> {
    const response =
      await apiClient.post<
        ApiResponse<EmployeeOnboardingTask>
      >(
        `/employee-onboarding-task/${id}/reopen`,
        dto,
      );

    return response.data.data;
  }
}