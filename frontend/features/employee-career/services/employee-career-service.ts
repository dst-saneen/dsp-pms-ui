import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api-response";

import { isRecruitmentMockEnabled } from "@/features/recruitment/constants/feature-flags";
import { RECRUITMENT_API } from "@/features/recruitment/constants/api-routes";
import { mapCareerTimeline, mapProbationQueue } from "@/features/recruitment/utils/api-mappers";

import { EmployeeCareerMockStore } from "../mocks/employee-career-mock-store";
import type { CareerTimelineView, EmployeeCareerTimeline } from "../types/career-timeline";
import type {
  ConfirmActiveDto,
  ConfirmActiveResult,
  ProbationConfirmationPreflight,
  ProbationDueQueueItem,
} from "../types/probation";
import { sanitizeCareerTimeline } from "../utils/sanitize-career-timeline";

export class EmployeeCareerService {
  static async getTimeline(
    employeeId: string,
    view: CareerTimelineView
  ): Promise<EmployeeCareerTimeline> {
    if (isRecruitmentMockEnabled()) {
      return EmployeeCareerMockStore.getTimeline(employeeId, view);
    }

    const path =
      view === "HR" ? RECRUITMENT_API.employeeCareer(employeeId) : RECRUITMENT_API.myCareer;

    const response = await apiClient.get<ApiResponse<unknown>>(path);
    const timeline = mapCareerTimeline(employeeId, view, unwrapApiData(response.data));
    return {
      ...timeline,
      view,
      events: view === "SANITIZED" ? sanitizeCareerTimeline(timeline.events) : timeline.events,
    };
  }

  static async listProbationDue(): Promise<ProbationDueQueueItem[]> {
    if (isRecruitmentMockEnabled()) {
      return EmployeeCareerMockStore.listProbationDue();
    }

    const response = await apiClient.get<ApiResponse<unknown>>(RECRUITMENT_API.probationDue, {
      params: { includeUpcoming: true },
    });
    return mapProbationQueue(unwrapApiData(response.data));
  }

  static async getProbationPreflight(employeeId: string): Promise<ProbationConfirmationPreflight> {
    if (isRecruitmentMockEnabled()) {
      return EmployeeCareerMockStore.getProbationPreflight(employeeId);
    }

    const queue = await this.listProbationDue();
    const item = queue.find((entry) => entry.employeeId === employeeId);
    if (!item) {
      throw new Error("CONFIRMATION_NOT_ALLOWED");
    }

    return {
      employeeId: item.employeeId,
      employeeName: item.employeeName,
      employeeCode: item.employeeCode,
      plannedEndDate: item.plannedEndDate,
      earliestConfirmationDate: item.plannedEndDate,
      canConfirm: item.canConfirmActive,
      blockedReason: item.confirmBlockedReason,
      allowEarlyOverride: Boolean(item.allowEarlyOverride),
      version: item.version,
    };
  }

  static async confirmActive(
    employeeId: string,
    dto: ConfirmActiveDto
  ): Promise<ConfirmActiveResult> {
    if (isRecruitmentMockEnabled()) {
      return EmployeeCareerMockStore.confirmActive(employeeId, dto);
    }

    const response = await apiClient.post<ApiResponse<unknown>>(
      RECRUITMENT_API.confirmActive(employeeId),
      {
        note: dto.note,
        override: Boolean(dto.earlyOverrideReason),
        overrideReason: dto.earlyOverrideReason,
      }
    );
    const data = unwrapApiData(response.data) as {
      employeeId?: string;
      employmentStatus?: string;
      probationConfirmedAt?: string;
    };

    return {
      employeeId: data.employeeId ?? employeeId,
      employmentStatus: data.employmentStatus ?? "ACTIVE",
      actualConfirmationDate: data.probationConfirmedAt?.slice(0, 10) ?? dto.confirmationDate,
    };
  }
}
