import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api-response";

import { isRecruitmentMockEnabled } from "../../constants/feature-flags";
import { RECRUITMENT_API, RECRUITMENT_LIST_LIMIT } from "../../constants/api-routes";
import {
  mapJobOpening,
  mapPublicationChecklist,
  toOpeningWritePayload,
  unwrapPagedItems,
} from "../../utils/api-mappers";
import { JobOpeningMockStore } from "../mocks/job-opening-mock-store";
import type { CreateJobOpeningDto } from "../types/create-job-opening";
import type { JobOpening } from "../types/job-opening";
import type { JobOpeningSearch } from "../types/job-opening-search";
import type { PublicationChecklist } from "../types/publication-checklist";
import type { UpdateJobOpeningDto } from "../types/update-job-opening";

export class JobOpeningService {
  static async getAll(filters?: JobOpeningSearch): Promise<JobOpening[]> {
    if (isRecruitmentMockEnabled()) {
      return JobOpeningMockStore.list(filters);
    }

    const response = await apiClient.get<ApiResponse<unknown>>(
      RECRUITMENT_API.openings,
      { params: { ...filters, page: 1, limit: RECRUITMENT_LIST_LIMIT } },
    );
    return unwrapPagedItems(unwrapApiData(response.data)).map(mapJobOpening);
  }

  static async getById(id: string): Promise<JobOpening> {
    if (isRecruitmentMockEnabled()) {
      const opening = JobOpeningMockStore.getById(id);
      if (!opening) throw new Error("NOT_FOUND");
      return opening;
    }

    const response = await apiClient.get<ApiResponse<unknown>>(
      RECRUITMENT_API.opening(id),
    );
    return mapJobOpening(unwrapApiData(response.data));
  }

  static async create(dto: CreateJobOpeningDto): Promise<JobOpening> {
    if (isRecruitmentMockEnabled()) {
      return JobOpeningMockStore.create(dto);
    }

    const response = await apiClient.post<ApiResponse<unknown>>(
      RECRUITMENT_API.openings,
      toOpeningWritePayload(dto),
    );
    return mapJobOpening(unwrapApiData(response.data));
  }

  static async update(id: string, dto: UpdateJobOpeningDto): Promise<JobOpening> {
    if (isRecruitmentMockEnabled()) {
      return JobOpeningMockStore.update(id, dto);
    }

    const response = await apiClient.patch<ApiResponse<unknown>>(
      RECRUITMENT_API.opening(id),
      toOpeningWritePayload(dto),
    );
    return mapJobOpening(unwrapApiData(response.data));
  }

  static async getPublicationChecklist(id: string): Promise<PublicationChecklist> {
    if (isRecruitmentMockEnabled()) {
      return JobOpeningMockStore.getPublicationChecklist(id);
    }

    const response = await apiClient.get<ApiResponse<unknown>>(
      RECRUITMENT_API.openingChecklist(id),
    );
    return mapPublicationChecklist(unwrapApiData(response.data));
  }

  static async publish(id: string, version: number): Promise<JobOpening> {
    if (isRecruitmentMockEnabled()) {
      return JobOpeningMockStore.publish(id, version);
    }

    const response = await apiClient.post<ApiResponse<unknown>>(
      RECRUITMENT_API.openingPublish(id),
      { version },
    );
    return mapJobOpening(unwrapApiData(response.data));
  }

  static async hold(id: string, version: number): Promise<JobOpening> {
    if (isRecruitmentMockEnabled()) {
      return JobOpeningMockStore.hold(id, version);
    }

    const response = await apiClient.post<ApiResponse<unknown>>(
      RECRUITMENT_API.openingHold(id),
      { version },
    );
    return mapJobOpening(unwrapApiData(response.data));
  }

  static async reopen(id: string, version: number): Promise<JobOpening> {
    if (isRecruitmentMockEnabled()) {
      return JobOpeningMockStore.reopen(id, version);
    }

    const response = await apiClient.post<ApiResponse<unknown>>(
      RECRUITMENT_API.openingReopen(id),
      { version },
    );
    return mapJobOpening(unwrapApiData(response.data));
  }

  static async close(id: string, version: number): Promise<JobOpening> {
    if (isRecruitmentMockEnabled()) {
      return JobOpeningMockStore.close(id, version);
    }

    const response = await apiClient.post<ApiResponse<unknown>>(
      RECRUITMENT_API.openingClose(id),
      { version },
    );
    return mapJobOpening(unwrapApiData(response.data));
  }
}
