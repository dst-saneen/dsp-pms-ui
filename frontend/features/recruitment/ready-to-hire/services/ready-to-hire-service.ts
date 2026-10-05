import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api-response";
import { securityService } from "@/features/security/security.service";

import { isRecruitmentMockEnabled } from "../../constants/feature-flags";
import { RECRUITMENT_API, RECRUITMENT_LIST_LIMIT } from "../../constants/api-routes";
import {
  mapConversionPreflight,
  mapConversionResult,
  mapReadyToHireItem,
  unwrapPagedItems,
} from "../../utils/api-mappers";
import { ReadyToHireMockStore } from "../mocks/ready-to-hire-mock-store";
import type {
  ConversionPreflight,
  ConversionResult,
  ConvertCandidateDto,
  InvitationDeliveryStatus,
  ReadyToHireQueueItem,
} from "../types/conversion-preflight";

export interface RetryConversionInvitationInput {
  applicationId: string;
  employeeId: string;
  userId?: string;
}

export class ReadyToHireService {
  static async listReadyToHire(): Promise<ReadyToHireQueueItem[]> {
    if (isRecruitmentMockEnabled()) {
      return ReadyToHireMockStore.listReadyToHire();
    }

    const response = await apiClient.get<ApiResponse<unknown>>(
      RECRUITMENT_API.applications,
      {
        params: {
          status: "OFFER_ACCEPTED",
          page: 1,
          limit: RECRUITMENT_LIST_LIMIT,
        },
      },
    );
    return unwrapPagedItems(unwrapApiData(response.data)).map(mapReadyToHireItem);
  }

  static async getPreflight(applicationId: string): Promise<ConversionPreflight> {
    if (isRecruitmentMockEnabled()) {
      return ReadyToHireMockStore.getPreflight(applicationId);
    }

    const response = await apiClient.get<ApiResponse<unknown>>(
      RECRUITMENT_API.conversionPreflight(applicationId),
    );
    return mapConversionPreflight(applicationId, unwrapApiData(response.data));
  }

  static async convert(
    applicationId: string,
    dto: ConvertCandidateDto,
  ): Promise<ConversionResult> {
    if (isRecruitmentMockEnabled()) {
      return ReadyToHireMockStore.convert(applicationId, dto);
    }

    // Backend is state-idempotent on application.employeeId; body is forwarded for
    // audit/version hints and forward-compatible command receipt fields.
    const response = await apiClient.post<ApiResponse<unknown>>(
      RECRUITMENT_API.convert(applicationId),
      {
        applicationVersion: dto.applicationVersion,
        acceptedOfferVersion: dto.acceptedOfferVersion,
        confirmationNote: dto.confirmationNote,
        operationId: dto.operationId,
      },
    );
    return mapConversionResult(applicationId, unwrapApiData(response.data));
  }

  static async retryInvitation(
    input: RetryConversionInvitationInput,
  ): Promise<InvitationDeliveryStatus> {
    if (isRecruitmentMockEnabled()) {
      return ReadyToHireMockStore.retryInvitation(input.employeeId);
    }

    if (input.userId) {
      await securityService.resendInvitation(input.userId);
      return "PENDING";
    }

    // Idempotent convert re-runs invitation delivery repair without creating duplicates.
    const result = await this.convert(input.applicationId, {
      applicationVersion: 0,
      acceptedOfferVersion: 0,
      operationId: crypto.randomUUID(),
      confirmationNote: "Invitation delivery repair",
    });
    return result.invitationDeliveryStatus;
  }
}
