import { apiClient } from "@/services/api-client";

import type { ApiResponse } from "@/types/api-response";
import type { OnboardingTemplateVersion } from "../types";

export interface OnboardingTemplateVersionValidationMessage {
  code?: string;
  path?: string;
  message?: string;
  versionId?: string;
  departmentTemplateId?: string;
  taskGroupId?: string;
  taskId?: string;
  field?: string;
}

export interface OnboardingTemplateVersionValidationResult {
  valid?: boolean;
  errorCount?: number;
  warningCount?: number;
  errors?: OnboardingTemplateVersionValidationMessage[];
  warnings?: OnboardingTemplateVersionValidationMessage[];
}

export interface ExecutableOnboardingAssetType {
  id: string;
  assetTypeCode: string;
  assetTypeName: string;
  trackingMode: "INDIVIDUAL" | "POOL" | "LOCATION" | null;
  kind?: string | null;
}

export class OnboardingTemplateVersionService {
  static async createDraft(versionId: string) {
    const response = await apiClient.post<ApiResponse<OnboardingTemplateVersion>>(
      `/onboarding-template-version/${versionId}/draft`
    );

    return response.data.data;
  }

  static async validate(versionId: string) {
    const response = await apiClient.post<ApiResponse<OnboardingTemplateVersionValidationResult>>(
      `/onboarding-template-version/${versionId}/validate`
    );

    return response.data.data;
  }

  static async publish(versionId: string, expectedVersion: number) {
    const response = await apiClient.post<ApiResponse<OnboardingTemplateVersion>>(
      `/onboarding-template-version/${versionId}/publish`,
      { expectedVersion }
    );

    return response.data.data;
  }

  static async listExecutableAssetTypes(versionId: string) {
    const response = await apiClient.get<ApiResponse<ExecutableOnboardingAssetType[]>>(
      `/onboarding-template-version/${versionId}/asset-types`
    );

    return response.data.data;
  }

  static async archive(versionId: string) {
    const response = await apiClient.post<ApiResponse<OnboardingTemplateVersion>>(
      `/onboarding-template-version/${versionId}/archive`
    );

    return response.data.data;
  }

  static async history(templateId: string) {
    const response = await apiClient.get<ApiResponse<OnboardingTemplateVersion[]>>(
      `/onboarding-template-version/template/${templateId}`
    );

    return response.data.data;
  }
}
