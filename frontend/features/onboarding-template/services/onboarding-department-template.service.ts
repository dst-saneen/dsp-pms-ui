import { apiClient } from "@/services/api-client";

import type { OnboardingDepartmentTemplate } from "@/features/onboarding-department-template";

interface CreateOnboardingDepartmentTemplateDto {
  onboardingTemplateVersionId: string;
  departmentId: string;
  displayOrder: number;
  isRequired: boolean;
  approvalWorkflowId?: string;
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
}
