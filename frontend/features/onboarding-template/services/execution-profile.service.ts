import { apiClient } from "@/services/api-client";

import type { ApiResponse } from "@/types/api-response";

import type {
  ExecutionProfileRow,
} from "@/features/onboarding-template/editor/canvas/task-editor/execution-profile";

export class ExecutionProfileService {

  static async getAll(): Promise<ExecutionProfileRow[]> {

    const response =
      await apiClient.get<
        ApiResponse<ExecutionProfileRow[]>
      >(
        "/onboarding-execution-profiles",
      );

    return response.data.data;

  }

  static async getById(
    id: string,
  ): Promise<ExecutionProfileRow> {

    const response =
      await apiClient.get<
        ApiResponse<ExecutionProfileRow>
      >(
        `/onboarding-execution-profiles/${id}`,
      );

    return response.data.data;

  }

  static async create(
    dto: ExecutionProfileRow,
  ): Promise<ExecutionProfileRow> {

    const response =
      await apiClient.post<
        ApiResponse<ExecutionProfileRow>
      >(
        "/onboarding-execution-profiles",
        dto,
      );

    return response.data.data;

  }

  static async update(
    id: string,
    dto: ExecutionProfileRow,
  ): Promise<ExecutionProfileRow> {

    const response =
      await apiClient.patch<
        ApiResponse<ExecutionProfileRow>
      >(
        `/onboarding-execution-profiles/${id}`,
        dto,
      );

    return response.data.data;

  }

  static async delete(
    id: string,
  ): Promise<void> {

    await apiClient.delete(
      `/onboarding-execution-profiles/${id}`,
    );

  }

}