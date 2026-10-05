import { apiClient } from "@/services/api-client";

import type {
  ApiResponse,
} from "@/types/api-response";

import type {
  OnboardingTemplateWorkspaceItem,
} from "../types";

export class OnboardingTemplateWorkspaceService {

  static async getAll()
  : Promise<
      OnboardingTemplateWorkspaceItem[]
    > {

    const response =
      await apiClient.get<
        ApiResponse<
          OnboardingTemplateWorkspaceItem[]
        >
      >(
        "/onboarding-template/workspace",
      );

    return response.data.data;

  }

}