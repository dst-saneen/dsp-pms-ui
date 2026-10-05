import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api-response";

import { isRecruitmentMockEnabled } from "../../constants/feature-flags";
import { RECRUITMENT_API, RECRUITMENT_LIST_LIMIT } from "../../constants/api-routes";
import {
  mapJobOffer,
  toOfferWritePayload,
  unwrapPagedItems,
} from "../../utils/api-mappers";
import { OfferMockStore } from "../mocks/offer-mock-store";
import type {
  CreateOfferDraftDto,
  JobOffer,
  JobOfferSearch,
  RetryOfferDeliveryDto,
  RevokeOfferDto,
  SendOfferDto,
  UpdateOfferDraftDto,
} from "../types/job-offer";

export class OfferService {
  static async getAll(filters?: JobOfferSearch): Promise<JobOffer[]> {
    if (isRecruitmentMockEnabled()) {
      return OfferMockStore.list(filters);
    }

    const response = await apiClient.get<ApiResponse<unknown>>(
      RECRUITMENT_API.offers,
      { params: { ...filters, page: 1, limit: RECRUITMENT_LIST_LIMIT } },
    );
    return unwrapPagedItems(unwrapApiData(response.data)).map(mapJobOffer);
  }

  static async getByApplication(applicationId: string): Promise<JobOffer[]> {
    if (isRecruitmentMockEnabled()) {
      return OfferMockStore.listByApplication(applicationId);
    }

    const response = await apiClient.get<ApiResponse<unknown>>(
      RECRUITMENT_API.applicationOffers(applicationId),
    );
    return unwrapPagedItems(unwrapApiData(response.data)).map(mapJobOffer);
  }

  static async getById(id: string): Promise<JobOffer> {
    if (isRecruitmentMockEnabled()) {
      const offer = OfferMockStore.getById(id);
      if (!offer) throw new Error("NOT_FOUND");
      return offer;
    }

    const response = await apiClient.get<ApiResponse<unknown>>(
      RECRUITMENT_API.offer(id),
    );
    return mapJobOffer(unwrapApiData(response.data));
  }

  static async createDraft(
    applicationId: string,
    dto?: CreateOfferDraftDto,
  ): Promise<JobOffer> {
    if (isRecruitmentMockEnabled()) {
      return OfferMockStore.createDraft(applicationId, dto);
    }

    const response = await apiClient.post<ApiResponse<unknown>>(
      RECRUITMENT_API.applicationOffers(applicationId),
      dto ? toOfferWritePayload(dto) : {},
    );
    return mapJobOffer(unwrapApiData(response.data));
  }

  static async updateDraft(
    id: string,
    dto: UpdateOfferDraftDto,
    applicationId?: string,
  ): Promise<JobOffer> {
    if (isRecruitmentMockEnabled()) {
      return OfferMockStore.updateDraft(id, dto);
    }

    const resolvedApplicationId = applicationId ?? (await this.getById(id)).jobApplicationId;
    const response = await apiClient.patch<ApiResponse<unknown>>(
      RECRUITMENT_API.applicationOffer(resolvedApplicationId, id),
      toOfferWritePayload(dto),
    );
    return mapJobOffer(unwrapApiData(response.data));
  }

  static async send(
    id: string,
    dto: SendOfferDto,
    applicationId?: string,
  ): Promise<JobOffer> {
    if (isRecruitmentMockEnabled()) {
      return OfferMockStore.send(id, dto);
    }

    const resolvedApplicationId = applicationId ?? (await this.getById(id)).jobApplicationId;
    const response = await apiClient.post<ApiResponse<unknown>>(
      RECRUITMENT_API.offerSend(resolvedApplicationId, id),
      dto,
    );
    return mapJobOffer(unwrapApiData(response.data));
  }

  static async retryDelivery(
    id: string,
    dto: RetryOfferDeliveryDto,
    applicationId?: string,
  ): Promise<JobOffer> {
    if (isRecruitmentMockEnabled()) {
      return OfferMockStore.retryDelivery(id, dto);
    }

    const resolvedApplicationId = applicationId ?? (await this.getById(id)).jobApplicationId;
    const response = await apiClient.post<ApiResponse<unknown>>(
      RECRUITMENT_API.offerRetry(resolvedApplicationId, id),
      dto,
    );
    return mapJobOffer(unwrapApiData(response.data));
  }

  static async revoke(
    id: string,
    dto: RevokeOfferDto,
    applicationId?: string,
  ): Promise<JobOffer> {
    if (isRecruitmentMockEnabled()) {
      return OfferMockStore.revoke(id, dto);
    }

    const resolvedApplicationId = applicationId ?? (await this.getById(id)).jobApplicationId;
    const response = await apiClient.post<ApiResponse<unknown>>(
      RECRUITMENT_API.offerRevoke(resolvedApplicationId, id),
      dto,
    );
    return mapJobOffer(unwrapApiData(response.data));
  }

  static async revise(
    sourceOfferId: string,
    applicationId?: string,
  ): Promise<JobOffer> {
    if (isRecruitmentMockEnabled()) {
      return OfferMockStore.revise(sourceOfferId);
    }

    const resolvedApplicationId =
      applicationId ?? (await this.getById(sourceOfferId)).jobApplicationId;
    const response = await apiClient.post<ApiResponse<unknown>>(
      RECRUITMENT_API.offerRevise(resolvedApplicationId, sourceOfferId),
      {},
    );
    return mapJobOffer(unwrapApiData(response.data));
  }
}
