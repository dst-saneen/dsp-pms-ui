import { apiClient } from "@/services/api-client";

import type { ApiResponse } from "@/types/api-response";

import type { OnboardingTaskGroup } from "../types";

export interface CreateOnboardingTaskGroupDto {
  onboardingDepartmentTemplateId: string;

  groupCode?: string;

  groupName: string;

  description?: string;

  displayOrder: number;

  isMandatory: boolean;
}

export interface UpdateOnboardingTaskGroupDto {
  groupCode?: string;

  groupName?: string;

  description?: string;

  displayOrder?: number;

  isMandatory?: boolean;

  expectedVersion: number;
}

export class OnboardingTaskGroupService {
  static async create(dto: CreateOnboardingTaskGroupDto): Promise<OnboardingTaskGroup> {
    const response = await apiClient.post<ApiResponse<OnboardingTaskGroup>>(
      "/onboarding-task-group",
      dto
    );

    return response.data.data;
  }

  static async getAll(): Promise<OnboardingTaskGroup[]> {
    const response =
      await apiClient.get<ApiResponse<OnboardingTaskGroup[]>>("/onboarding-task-group");

    return response.data.data;
  }

  static async getById(id: string): Promise<OnboardingTaskGroup> {
    const response = await apiClient.get<ApiResponse<OnboardingTaskGroup>>(
      `/onboarding-task-group/${id}`
    );

    return response.data.data;
  }

  static async getByDepartmentTemplate(
    departmentTemplateId: string
  ): Promise<OnboardingTaskGroup[]> {
    const response = await apiClient.get<ApiResponse<OnboardingTaskGroup[]>>(
      `/onboarding-task-group/department-template/${departmentTemplateId}`
    );

    return response.data.data;
  }

  static async update(id: string, dto: UpdateOnboardingTaskGroupDto): Promise<OnboardingTaskGroup> {
    const response = await apiClient.patch<ApiResponse<OnboardingTaskGroup>>(
      `/onboarding-task-group/${id}`,
      dto
    );

    return response.data.data;
  }

  static async delete(id: string, expectedVersion: number): Promise<void> {
    await apiClient.delete(`/onboarding-task-group/${id}`, { params: { expectedVersion } });
  }
}
