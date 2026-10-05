import { apiClient } from "@/services/api-client";
import type { ApiResponse } from "@/types/api";

import type {
  OwnerEmployeeSelectionInput,
  OrganizationOnboardingStatus,
  OrganizationOnboardingStep,
} from "./types";

export const organizationOnboardingService = {
  async status(): Promise<OrganizationOnboardingStatus> {
    const { data } =
      await apiClient.get<ApiResponse<OrganizationOnboardingStatus>>(
        "/organization-onboarding"
      );
    return data.data;
  },

  async updateStep(
    currentStep: OrganizationOnboardingStep
  ): Promise<OrganizationOnboardingStatus> {
    const { data } =
      await apiClient.patch<ApiResponse<OrganizationOnboardingStatus>>(
        "/organization-onboarding/step",
        { currentStep }
      );
    return data.data;
  },

  async complete(
    selection: OwnerEmployeeSelectionInput
  ): Promise<OrganizationOnboardingStatus> {
    const { data } =
      await apiClient.post<ApiResponse<OrganizationOnboardingStatus>>(
        "/organization-onboarding/complete",
        selection
      );
    return data.data;
  },

  async repairOwnerEmployee(
    selection: OwnerEmployeeSelectionInput
  ): Promise<OrganizationOnboardingStatus> {
    const { data } =
      await apiClient.post<ApiResponse<OrganizationOnboardingStatus>>(
        "/organization-onboarding/repair-owner-employee",
        selection
      );
    return data.data;
  },
};
