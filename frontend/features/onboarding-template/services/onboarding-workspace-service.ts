import { apiClient } from "@/services/api-client";

import type { ApiResponse } from "@/types/api-response";

import type { OnboardingWorkspace } from "../workspace";

export class OnboardingWorkspaceService {
  static async getEditor(
    id: string,
  ): Promise<OnboardingWorkspace> {
    const response =
      await apiClient.get<
        ApiResponse<OnboardingWorkspace>
      >(`/onboarding-template/${id}/editor`);

    return response.data.data;
  }
}