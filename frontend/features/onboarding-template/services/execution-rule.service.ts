import { apiClient } from "@/services/api-client";
import type { ApiResponse } from "@/types/api-response";

import type {
  ExecutionRuleRow,
} from "@/features/onboarding-template/editor/canvas/task-editor/execution-rule";

export class ExecutionRuleService {

  static async getAll(): Promise<ExecutionRuleRow[]> {

    const response =
      await apiClient.get<
        ApiResponse<ExecutionRuleRow[]>
      >(
        "/onboarding-execution-rules",
      );

    return response.data.data;

  }

  static async getByExecutionProfile(
    executionProfileId: string,
  ): Promise<ExecutionRuleRow[]> {

    const response =
      await apiClient.get<
        ApiResponse<ExecutionRuleRow[]>
      >(
        `/onboarding-execution-rules/execution-profile/${executionProfileId}`,
      );

    return response.data.data;

  }

  static async create(
    dto: ExecutionRuleRow,
  ): Promise<ExecutionRuleRow> {

    const response =
      await apiClient.post<
        ApiResponse<ExecutionRuleRow>
      >(
        "/onboarding-execution-rules",
        dto,
      );

    return response.data.data;

  }

  static async update(
    id: string,
    dto: ExecutionRuleRow,
  ): Promise<ExecutionRuleRow> {

    const response =
      await apiClient.patch<
        ApiResponse<ExecutionRuleRow>
      >(
        `/onboarding-execution-rules/${id}`,
        dto,
      );

    return response.data.data;

  }

  static async delete(
    id: string,
  ): Promise<void> {

    await apiClient.delete(
      `/onboarding-execution-rules/${id}`,
    );

  }

}