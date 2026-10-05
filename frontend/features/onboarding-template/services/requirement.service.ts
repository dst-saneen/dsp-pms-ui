import { apiClient } from "@/services/api-client";

import type {
  ApiResponse,
} from "@/types/api-response";

import type {
  RequirementRow,
} from "../editor/canvas/task-editor/requirement/requirement-columns";

export class RequirementService {

  static async getAll(): Promise<
    RequirementRow[]
  > {

    const response =
      await apiClient.get<
        ApiResponse<RequirementRow[]>
      >(
        "/onboarding-requirements",
      );

    return response.data.data;

  }

  static async getById(
    id: string,
  ): Promise<RequirementRow> {

    const response =
      await apiClient.get<
        ApiResponse<RequirementRow>
      >(
        `/onboarding-requirements/${id}`,
      );

    return response.data.data;

  }

  static async create(
    dto: RequirementRow,
  ): Promise<RequirementRow> {

    const response =
      await apiClient.post<
        ApiResponse<RequirementRow>
      >(
        "/onboarding-requirements",
        dto,
      );

    return response.data.data;

  }

  static async update(
    id: string,
    dto: RequirementRow,
  ): Promise<RequirementRow> {

    const response =
      await apiClient.patch<
        ApiResponse<RequirementRow>
      >(
        `/onboarding-requirements/${id}`,
        dto,
      );

    return response.data.data;

  }

  static async delete(
    id: string,
  ): Promise<void> {

    await apiClient.delete(
      `/onboarding-requirements/${id}`,
    );

  }

}