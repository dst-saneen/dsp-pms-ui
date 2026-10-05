import { apiClient } from "@/services/api-client";

import type { ApiResponse } from "@/types/api-response";

import type {
  CreateOnboardingTemplate,
  OnboardingTemplate,
  OnboardingTemplateSearch,
  OnboardingTemplateSummary,
  UpdateOnboardingTemplate,
} from "../types";

export class OnboardingTemplateService {
  static async getAll(params?: OnboardingTemplateSearch): Promise<OnboardingTemplate[]> {
    const response = await apiClient.get<ApiResponse<OnboardingTemplate[]>>(
      "/onboarding-template",
      {
        params,
      }
    );

    return response.data.data;
  }

  static async getSummary(): Promise<OnboardingTemplateSummary> {
    const response = await apiClient.get<ApiResponse<OnboardingTemplateSummary>>(
      "/onboarding-template/summary"
    );

    return response.data.data;
  }

  static async getById(id: string): Promise<OnboardingTemplate> {
    const response = await apiClient.get<ApiResponse<OnboardingTemplate>>(
      `/onboarding-template/${id}`
    );

    return response.data.data;
  }

  static async create(dto: CreateOnboardingTemplate): Promise<OnboardingTemplate> {
    const response = await apiClient.post<ApiResponse<OnboardingTemplate>>(
      "/onboarding-template",
      dto
    );

    return response.data.data;
  }

  static async createDepartmentTemplate(data: {
    onboardingTemplateVersionId: string;
    departmentId: string;
  }): Promise<void> {
    await apiClient.post("/onboarding-department-template", data);
  }

  static async update(id: string, dto: UpdateOnboardingTemplate): Promise<OnboardingTemplate> {
    const response = await apiClient.patch<ApiResponse<OnboardingTemplate>>(
      `/onboarding-template/${id}`,
      dto
    );

    return response.data.data;
  }

  static async delete(id: string): Promise<void> {
    await apiClient.delete(`/onboarding-template/${id}`);
  }

  static async deleteDepartmentTemplate(id: string, expectedVersion: number): Promise<void> {
    await apiClient.delete(`/onboarding-department-template/${id}`, {
      params: { expectedVersion },
    });
  }
}
