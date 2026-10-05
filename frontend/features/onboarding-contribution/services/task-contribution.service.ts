import { apiClient } from "@/services/api-client";

import type { ApiResponse } from "@/types/api-response";

export interface TaskContribution {
  id: string;

  taskId: string;

  contributionId: string;

  displayOrder: number;

  isRequired: boolean;

  contribution: {
    id: string;
    contributionCode: string;
    contributionName: string;
    description?: string;
  };
}

export interface CreateTaskContributionDto {
  taskId: string;

  contributionId: string;

  displayOrder?: number;

  isRequired?: boolean;
}

export interface UpdateTaskContributionDto {
  displayOrder?: number;

  isRequired?: boolean;
}

export class TaskContributionService {

  static async getByTask(
    taskId: string,
  ): Promise<TaskContribution[]> {

    const response =
      await apiClient.get<
        ApiResponse<TaskContribution[]>
      >(
        `/task-contribution/task/${taskId}`,
      );

    return response.data.data;

  }

  static async create(
    dto: CreateTaskContributionDto,
  ): Promise<TaskContribution> {

    const response =
      await apiClient.post<
        ApiResponse<TaskContribution>
      >(
        "/task-contribution",
        dto,
      );

    return response.data.data;

  }

  static async update(
    id: string,
    dto: UpdateTaskContributionDto,
  ): Promise<TaskContribution> {

    const response =
      await apiClient.patch<
        ApiResponse<TaskContribution>
      >(
        `/task-contribution/${id}`,
        dto,
      );

    return response.data.data;

  }

  static async delete(
    id: string,
  ): Promise<void> {

    await apiClient.delete(
      `/task-contribution/${id}`,
    );

  }

}