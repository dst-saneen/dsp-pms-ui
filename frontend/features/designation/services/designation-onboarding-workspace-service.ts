import { apiClient } from "@/services/api-client";

export const DesignationOnboardingWorkspaceService = {

  async getAll(
    params?: {
      keyword?: string;
      companyId?: string;
    },
  ) {

    const response =
      await apiClient.get(
        "/designations/onboarding-workspace",
        {
          params,
        },
      );

    return response.data.data;

  },

};
