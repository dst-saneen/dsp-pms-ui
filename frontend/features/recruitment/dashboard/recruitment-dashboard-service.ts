import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api-response";

import { isRecruitmentMockEnabled } from "../constants/feature-flags";
import { RECRUITMENT_API } from "../constants/api-routes";

export interface RecruitmentDashboardKpis {
  openOpenings: number;
  newApplications: number;
  interviewsToday: number;
  readyToHire: number;
}

export class RecruitmentDashboardService {
  static async getKpis(): Promise<RecruitmentDashboardKpis> {
    if (isRecruitmentMockEnabled()) {
      return {
        openOpenings: 0,
        newApplications: 0,
        interviewsToday: 0,
        readyToHire: 0,
      };
    }

    const response = await apiClient.get<ApiResponse<{ kpis?: Record<string, number> }>>(
      RECRUITMENT_API.dashboard,
    );
    const data = unwrapApiData(response.data);
    const kpis = data.kpis ?? {};

    return {
      openOpenings: Number(kpis.openOpenings ?? 0),
      newApplications: Number(kpis.newApplications ?? 0),
      interviewsToday: Number(kpis.interviewsToday ?? 0),
      readyToHire: Number(kpis.readyToHire ?? 0),
    };
  }
}
