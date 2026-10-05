import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api-response";

import { isRecruitmentMockEnabled } from "../../constants/feature-flags";
import { RECRUITMENT_API } from "../../constants/api-routes";
import {
  mapHiringComparison,
  mapHiringQueue,
  mapJobApplication,
} from "../../utils/api-mappers";
import { HiringDecisionMockStore } from "../mocks/hiring-decision-mock-store";
import type {
  HiringComparisonView,
  HiringDecisionDto,
  HiringDecisionQueueItem,
} from "../types/hiring-decision";
import type { JobApplication } from "../../applications/types/job-application";

export class HiringDecisionService {
  static async getQueue(
    hiringManagerEmployeeId: string,
  ): Promise<HiringDecisionQueueItem[]> {
    if (isRecruitmentMockEnabled()) {
      return HiringDecisionMockStore.getQueue(hiringManagerEmployeeId);
    }

    const response = await apiClient.get<ApiResponse<unknown>>(
      RECRUITMENT_API.meHiringDecisions,
    );
    return mapHiringQueue(unwrapApiData(response.data));
  }

  static async getComparison(
    openingId: string,
    hiringManagerEmployeeId: string,
  ): Promise<HiringComparisonView> {
    if (isRecruitmentMockEnabled()) {
      return HiringDecisionMockStore.getComparison(
        openingId,
        hiringManagerEmployeeId,
      );
    }

    const response = await apiClient.get<ApiResponse<unknown>>(
      RECRUITMENT_API.meOpeningComparison(openingId),
    );
    return mapHiringComparison(unwrapApiData(response.data));
  }

  static async selectCandidate(
    applicationId: string,
    hiringManagerEmployeeId: string,
    dto: HiringDecisionDto,
  ): Promise<JobApplication> {
    if (isRecruitmentMockEnabled()) {
      return HiringDecisionMockStore.selectCandidate(
        applicationId,
        hiringManagerEmployeeId,
        dto,
      );
    }

    const response = await apiClient.post<ApiResponse<unknown>>(
      RECRUITMENT_API.meSelectApplication(applicationId),
      dto,
    );
    return mapJobApplication(unwrapApiData(response.data));
  }

  static async rejectCandidate(
    applicationId: string,
    hiringManagerEmployeeId: string,
    dto: HiringDecisionDto,
  ): Promise<JobApplication> {
    if (isRecruitmentMockEnabled()) {
      return HiringDecisionMockStore.rejectCandidate(
        applicationId,
        hiringManagerEmployeeId,
        dto,
      );
    }

    const response = await apiClient.post<ApiResponse<unknown>>(
      RECRUITMENT_API.meRejectApplication(applicationId),
      dto,
    );
    return mapJobApplication(unwrapApiData(response.data));
  }
}
