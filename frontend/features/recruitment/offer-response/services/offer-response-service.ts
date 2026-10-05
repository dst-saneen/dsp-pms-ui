import { apiClient, getApiErrorCode, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api-response";

import { isRecruitmentMockEnabled } from "../../constants/feature-flags";
import { RECRUITMENT_API } from "../../constants/api-routes";
import { mapOfferInspection, mapOfferResponseResult } from "../../utils/api-mappers";
import { OfferResponseMockStore } from "../mocks/offer-response-mock-store";
import type {
  DeclineOfferInput,
  OfferResponseInput,
  OfferResponseInspection,
  OfferResponseResult,
} from "../types/offer-response";

export class OfferResponseService {
  static async inspect(token: string): Promise<OfferResponseInspection> {
    if (isRecruitmentMockEnabled()) {
      return OfferResponseMockStore.inspect(token);
    }

    try {
      const response = await apiClient.get<ApiResponse<unknown>>(RECRUITMENT_API.offerInspect, {
        params: { token },
      });
      return mapOfferInspection(unwrapApiData(response.data));
    } catch (error) {
      const code = getApiErrorCode(error);
      if (code === "OFFER_TOKEN_INVALID") {
        return {
          state: "INVALID",
          message: "This offer link is invalid or expired.",
          canRespond: false,
          canDownloadPdf: false,
        };
      }
      throw error;
    }
  }

  static async accept(token: string, input: OfferResponseInput): Promise<OfferResponseResult> {
    if (isRecruitmentMockEnabled()) {
      return OfferResponseMockStore.accept(token, input);
    }

    const response = await apiClient.post<ApiResponse<unknown>>(RECRUITMENT_API.offerAccept, {
      token,
      legalName: input.legalName,
      acknowledgementAccepted: input.acknowledgement,
    });
    return mapOfferResponseResult(unwrapApiData(response.data));
  }

  static async decline(token: string, input: DeclineOfferInput): Promise<OfferResponseResult> {
    if (isRecruitmentMockEnabled()) {
      return OfferResponseMockStore.decline(token, input);
    }

    const response = await apiClient.post<ApiResponse<unknown>>(RECRUITMENT_API.offerDecline, {
      token,
      legalName: input.legalName,
      acknowledgementAccepted: input.acknowledgement,
      comment: input.reason,
    });
    return mapOfferResponseResult(unwrapApiData(response.data));
  }

  static async downloadDocument(token: string, downloadToken: string) {
    if (isRecruitmentMockEnabled()) {
      throw new Error("OFFER_DOCUMENT_UNAVAILABLE");
    }

    const response = await apiClient.post(
      RECRUITMENT_API.offerDocumentDownload,
      { token, downloadToken },
      { responseType: "blob" }
    );

    const contentType = response.headers["content-type"];
    const blob = new Blob([response.data], {
      type: typeof contentType === "string" ? contentType : "application/pdf",
    });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "offer.pdf";
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  }

  static async createSignedOfferUploadSession(
    token: string,
    params: {
      fileName: string;
      declaredMimeType: string;
      sizeBytes: number;
      checksumSha256: string;
      operationId: string;
    },
  ) {
    const response = await apiClient.post<ApiResponse<unknown>>(
      `/public/offers/${encodeURIComponent(token)}/upload-sessions`,
      params,
    );
    const session = unwrapApiData(response.data) as {
      id: string;
      status: string;
      sessionToken?: string;
      upload: {
        method: "PUT";
        url: string;
        headers: Record<string, string>;
        expiresAt: string;
      } | null;
    };

    return {
      ...session,
      upload: {
        method: "PUT" as const,
        url: `/api/public/offers/${encodeURIComponent(token)}/upload-sessions/${session.id}/content`,
        headers: {
          "Content-Type": params.declaredMimeType || "application/pdf",
        },
        expiresAt:
          session.upload?.expiresAt ??
          new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
    };
  }

  static async finalizeSignedOfferUploadSession(
    token: string,
    sessionId: string,
    sessionToken?: string,
  ) {
    const response = await apiClient.post<ApiResponse<unknown>>(
      `/public/offers/${encodeURIComponent(token)}/upload-sessions/${sessionId}/finalize`,
      {},
      {
        headers: sessionToken
          ? { 'X-File-Session-Token': sessionToken }
          : undefined,
      },
    );
    return unwrapApiData(response.data) as {
      id: string;
      version: number;
      status: string;
      scan: { status: string; safeErrorCode: string | null };
      fileObjectId: string | null;
      allowedActions: string[];
    };
  }

  static async pollUploadSession(
    token: string,
    sessionId: string,
    sessionToken?: string,
  ) {
    const response = await apiClient.get<ApiResponse<unknown>>(
      `/public/offers/${encodeURIComponent(token)}/upload-sessions/${sessionId}`,
      {
        headers: sessionToken
          ? { 'X-File-Session-Token': sessionToken }
          : undefined,
      },
    );
    return unwrapApiData(response.data) as {
      id: string;
      version: number;
      status: string;
      scan: { status: string; safeErrorCode: string | null };
      fileObjectId: string | null;
      allowedActions: string[];
    };
  }

  static async acceptWithSignedDocument(
    token: string,
    input: {
      legalName: string;
      declarationAccepted: true;
      uploadSessionId: string;
      expectedOfferVersion: number;
      operationId: string;
    },
  ): Promise<OfferResponseResult> {
    const response = await apiClient.post<ApiResponse<unknown>>(
      `/public/offers/${encodeURIComponent(token)}/accept-with-signed-document`,
      input,
    );
    return mapOfferResponseResult(unwrapApiData(response.data));
  }

  static getMockResponsePath(offerId: string) {
    if (isRecruitmentMockEnabled()) {
      const token = OfferResponseMockStore.getTokenForOffer(offerId);
      if (!token) return null;
      return `/offer-response?token=${encodeURIComponent(token)}`;
    }
    return null;
  }
}
