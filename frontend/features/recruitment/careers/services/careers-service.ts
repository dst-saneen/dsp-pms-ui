import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api-response";

import { isRecruitmentMockEnabled } from "../../constants/feature-flags";
import { RECRUITMENT_API } from "../../constants/api-routes";
import {
  mapPublicCompany,
  mapPublicOpeningDetail,
  mapPublicOpenings,
} from "../../utils/api-mappers";
import { CareersMockStore } from "../mocks/careers-mock-store";
import type {
  PublicApplicationReceipt,
  PublicCompanyProfile,
  PublicJobOpeningDetail,
  PublicJobOpeningListItem,
  SubmitPublicApplicationInput,
} from "../types/public-careers";
import { toSafePublicReceipt } from "../utils/safe-public-receipt";

export class CareersService {
  static async getCompany(companyCode: string): Promise<PublicCompanyProfile> {
    if (isRecruitmentMockEnabled()) {
      const company = CareersMockStore.resolveCompany(companyCode);
      if (!company) throw new Error("COMPANY_NOT_FOUND");
      return company;
    }

    const response = await apiClient.get<ApiResponse<unknown>>(
      RECRUITMENT_API.publicCareers(companyCode),
      { skipAuthRefresh: true },
    );
    return mapPublicCompany(unwrapApiData(response.data));
  }

  static async listOpenings(companyCode: string): Promise<PublicJobOpeningListItem[]> {
    if (isRecruitmentMockEnabled()) {
      return CareersMockStore.listOpenings(companyCode);
    }

    const response = await apiClient.get<ApiResponse<unknown>>(
      RECRUITMENT_API.publicCareers(companyCode),
      { skipAuthRefresh: true },
    );
    return mapPublicOpenings(unwrapApiData(response.data));
  }

  static async getOpening(
    companyCode: string,
    openingCode: string
  ): Promise<PublicJobOpeningDetail> {
    if (isRecruitmentMockEnabled()) {
      return CareersMockStore.getOpening(companyCode, openingCode);
    }

    const response = await apiClient.get<ApiResponse<unknown>>(
      RECRUITMENT_API.publicJob(companyCode, openingCode),
      { skipAuthRefresh: true },
    );
    return mapPublicOpeningDetail(unwrapApiData(response.data));
  }

  static async submitApplication(
    companyCode: string,
    openingCode: string,
    input: SubmitPublicApplicationInput
  ): Promise<PublicApplicationReceipt> {
    if (isRecruitmentMockEnabled()) {
      return CareersMockStore.submitApplication(companyCode, openingCode, input);
    }

    const formData = new FormData();
    formData.append("firstName", input.firstName);
    formData.append("lastName", input.lastName);
    formData.append("email", input.email);
    if (input.mobile) formData.append("mobile", input.mobile);
    if (input.coverNote) formData.append("coverNote", input.coverNote);
    formData.append("privacyAcknowledged", String(input.privacyAcknowledged));
    formData.append("privacyAckVersion", "careers-v1");
    formData.append("idempotencyKey", input.idempotencyKey);
    if (input.turnstileToken) {
      formData.append("turnstileToken", input.turnstileToken);
    }
    if (input.honeypot) {
      formData.append("website", input.honeypot);
      formData.append("honeypot", input.honeypot);
    }
    if (input.cvFile) {
      formData.append("cv", input.cvFile);
    }
    for (const file of input.supportingFiles ?? []) {
      formData.append("supportingDocuments", file);
    }

    const response = await apiClient.post<ApiResponse<unknown>>(
      RECRUITMENT_API.publicApply(companyCode, openingCode),
      formData,
      { skipAuthRefresh: true },
    );
    const data = unwrapApiData(response.data) as {
      applicationCode?: string;
      status?: string;
      message?: string;
    };
    return toSafePublicReceipt({
      receiptReference: data.applicationCode ?? "RECEIVED",
      message: data.message,
    });
  }
}
