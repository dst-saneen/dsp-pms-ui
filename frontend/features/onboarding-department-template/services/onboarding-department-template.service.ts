"use client";

import { apiClient } from "@/services/api-client";

import type { OnboardingDepartmentTemplate } from "../types";

interface CreateOnboardingDepartmentTemplateDto {
  onboardingTemplateVersionId: string;
  departmentId: string;
  displayOrder: number;
  isRequired: boolean;
}

interface UpdateOnboardingDepartmentTemplateDto {
  displayOrder?: number;
  isRequired?: boolean;
  expectedVersion: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export class OnboardingDepartmentTemplateService {

  static async create(
    dto: CreateOnboardingDepartmentTemplateDto,
  ) {
    const response =
      await apiClient.post<ApiResponse<OnboardingDepartmentTemplate>>(
        "/onboarding-department-template",
        dto,
      );

    return response.data.data;
  }

  static async findOne(
    id: string,
  ) {

    const response =
      await apiClient.get<ApiResponse<OnboardingDepartmentTemplate>>(
        `/onboarding-department-template/${id}`,
      );

    return response.data.data;

  }

  static async update(
    id: string,
    dto: UpdateOnboardingDepartmentTemplateDto,
  ) {
    const response =
      await apiClient.patch<ApiResponse<OnboardingDepartmentTemplate>>(
        `/onboarding-department-template/${id}`,
        dto,
      );

    return response.data.data;
  }

  static async delete(
    id: string,
  ) {
    await apiClient.delete(
      `/onboarding-department-template/${id}`,
    );
  }
}
