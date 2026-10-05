import { apiClient } from "@/services/api-client";

import type { ApiResponse } from "@/types/api-response";

import type {
  CreateOnboardingTemplateTask,
  OnboardingTemplateTask,
  OnboardingTemplateTaskSearch,
  UpdateOnboardingTemplateTask,
} from "../types";

export class OnboardingTemplateTaskService {
  static async getAll(params?: OnboardingTemplateTaskSearch): Promise<OnboardingTemplateTask[]> {
    const response = await apiClient.get<ApiResponse<OnboardingTemplateTask[]>>(
      "/onboarding-template-task",
      {
        params,
      }
    );

    return response.data.data;
  }

  static async getById(id: string): Promise<OnboardingTemplateTask> {
    const response = await apiClient.get<ApiResponse<OnboardingTemplateTask>>(
      `/onboarding-template-task/${id}`
    );

    return response.data.data;
  }

  static async getByTaskGroup(taskGroupId: string): Promise<OnboardingTemplateTask[]> {
    const response = await apiClient.get<ApiResponse<OnboardingTemplateTask[]>>(
      `/onboarding-template-task/task-group/${taskGroupId}`
    );

    return response.data.data;
  }

  static async create(dto: CreateOnboardingTemplateTask): Promise<OnboardingTemplateTask> {
    const response = await apiClient.post<ApiResponse<OnboardingTemplateTask>>(
      "/onboarding-template-task",
      dto
    );

    return response.data.data;
  }

  static async update(
    id: string,
    dto: UpdateOnboardingTemplateTask
  ): Promise<OnboardingTemplateTask> {
    const response = await apiClient.patch<ApiResponse<OnboardingTemplateTask>>(
      `/onboarding-template-task/${id}`,
      dto
    );

    return response.data.data;
  }

  static async delete(id: string, expectedVersion: number): Promise<void> {
    await apiClient.delete(`/onboarding-template-task/${id}`, { params: { expectedVersion } });
  }
}
