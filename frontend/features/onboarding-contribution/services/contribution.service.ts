import { apiClient } from "@/services/api-client";

import type {
  ApiResponse,
} from "@/types/api-response";

import type {
  Contribution,
  CreateContributionDto,
  UpdateContributionDto,
} from "../types";

export class ContributionService {

  static async create(
    dto: CreateContributionDto,
  ): Promise<Contribution> {

    const response =
      await apiClient.post<
        ApiResponse<Contribution>
      >(
        "/onboarding-contribution",
        dto,
      );

    return response.data.data;

  }

  static async getAll(): Promise<
    Contribution[]
  > {

    const response =
      await apiClient.get<
        ApiResponse<Contribution[]>
      >(
        "/onboarding-contribution",
      );

    return response.data.data;

  }

  static async getById(
    id: string,
  ): Promise<Contribution> {

    const response =
      await apiClient.get<
        ApiResponse<Contribution>
      >(
        `/onboarding-contribution/${id}`,
      );

    return response.data.data;

  }

  static async update(
    id: string,
    dto: UpdateContributionDto,
  ): Promise<Contribution> {

    const response =
      await apiClient.patch<
        ApiResponse<Contribution>
      >(
        `/onboarding-contribution/${id}`,
        dto,
      );

    return response.data.data;

  }

  static async delete(
    id: string,
  ): Promise<void> {

    await apiClient.delete(
      `/onboarding-contribution/${id}`,
    );

  }

}