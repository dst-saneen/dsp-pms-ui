import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api-response";

import { isRecruitmentMockEnabled } from "../../constants/feature-flags";
import { RECRUITMENT_API, RECRUITMENT_LIST_LIMIT } from "../../constants/api-routes";
import {
  combineDateTime,
  mapInterviewSession,
  mapMyEvaluationContext,
  unwrapPagedItems,
} from "../../utils/api-mappers";
import { InterviewMockStore } from "../mocks/interview-mock-store";
import type {
  CancelInterviewDto,
  CompleteInterviewDto,
  InterviewEvaluation,
  InterviewSearch,
  InterviewSession,
  RescheduleInterviewDto,
  SaveEvaluationDraftDto,
  ScheduleInterviewDto,
  SubmitEvaluationDto,
} from "../types/interview";

function toSchedulePayload(dto: ScheduleInterviewDto) {
  const { scheduledStartAt, scheduledEndAt } = combineDateTime(
    dto.scheduledDate,
    dto.scheduledTime,
    dto.durationMinutes,
  );

  return {
    roundNumber: dto.roundNumber,
    roundName: dto.roundName,
    isRequired: dto.isRequired,
    scheduledStartAt,
    scheduledEndAt,
    timezone: dto.timezone,
    mode: dto.mode,
    locationOrLink: dto.locationOrLink,
    evaluationDeadlineAt: dto.evaluationDeadline || undefined,
    applicationVersion: dto.applicationVersion,
    panelMembers: dto.panelMembers.map((member) => ({
      employeeId: member.employeeId,
      isLead: member.employeeId === dto.leadInterviewerEmployeeId,
    })),
  };
}

function toReschedulePayload(dto: RescheduleInterviewDto) {
  const { scheduledStartAt, scheduledEndAt } = combineDateTime(
    dto.scheduledDate,
    dto.scheduledTime,
    dto.durationMinutes,
  );

  return {
    scheduledStartAt,
    scheduledEndAt,
    timezone: dto.timezone,
    reason: dto.reason,
  };
}

export class InterviewService {
  static async getAll(filters?: InterviewSearch): Promise<InterviewSession[]> {
    if (isRecruitmentMockEnabled()) {
      return InterviewMockStore.list(filters);
    }

    const response = await apiClient.get<ApiResponse<unknown>>(
      RECRUITMENT_API.interviews,
      { params: { ...filters, page: 1, limit: RECRUITMENT_LIST_LIMIT } },
    );
    return unwrapPagedItems(unwrapApiData(response.data)).map(mapInterviewSession);
  }

  static async getById(id: string): Promise<InterviewSession> {
    if (isRecruitmentMockEnabled()) {
      const session = InterviewMockStore.getById(id);
      if (!session) throw new Error("NOT_FOUND");
      return session;
    }

    const sessions = await this.getAll();
    const session = sessions.find((item) => item.id === id);
    if (!session) throw new Error("NOT_FOUND");
    return session;
  }

  static async getByApplication(applicationId: string): Promise<InterviewSession[]> {
    if (isRecruitmentMockEnabled()) {
      return InterviewMockStore.listByApplication(applicationId);
    }

    const response = await apiClient.get<ApiResponse<unknown>>(
      RECRUITMENT_API.applicationInterviews(applicationId),
    );
    return unwrapPagedItems(unwrapApiData(response.data)).map(mapInterviewSession);
  }

  static async getAssigned(panelMemberEmployeeId: string): Promise<InterviewSession[]> {
    if (isRecruitmentMockEnabled()) {
      return InterviewMockStore.list({
        panelMemberEmployeeId,
      }).filter(
        (session) =>
          session.status === "SCHEDULED" || session.status === "RESCHEDULED",
      );
    }

    const response = await apiClient.get<ApiResponse<unknown>>(
      RECRUITMENT_API.meInterviews,
    );
    return unwrapPagedItems(unwrapApiData(response.data)).map(mapInterviewSession);
  }

  static async getMyEvaluation(sessionId: string) {
    if (isRecruitmentMockEnabled()) {
      throw new Error("Use panel mock evaluation in mock mode");
    }

    const response = await apiClient.get<ApiResponse<unknown>>(
      RECRUITMENT_API.meEvaluation(sessionId),
    );
    return mapMyEvaluationContext(unwrapApiData(response.data));
  }

  static async schedule(dto: ScheduleInterviewDto): Promise<InterviewSession> {
    if (isRecruitmentMockEnabled()) {
      return InterviewMockStore.schedule(dto);
    }

    const response = await apiClient.post<ApiResponse<unknown>>(
      RECRUITMENT_API.applicationInterviews(dto.jobApplicationId),
      toSchedulePayload(dto),
    );
    return mapInterviewSession(unwrapApiData(response.data));
  }

  static async reschedule(
    id: string,
    dto: RescheduleInterviewDto,
    applicationId?: string,
  ): Promise<InterviewSession> {
    if (isRecruitmentMockEnabled()) {
      return InterviewMockStore.reschedule(id, dto);
    }

    const response = await apiClient.post<ApiResponse<unknown>>(
      RECRUITMENT_API.interviewReschedule(applicationId ?? "", id),
      toReschedulePayload(dto),
    );
    return mapInterviewSession(unwrapApiData(response.data));
  }

  static async cancel(
    id: string,
    dto: CancelInterviewDto,
    applicationId?: string,
  ): Promise<InterviewSession> {
    if (isRecruitmentMockEnabled()) {
      return InterviewMockStore.cancel(id, dto);
    }

    const response = await apiClient.post<ApiResponse<unknown>>(
      RECRUITMENT_API.interviewCancel(applicationId ?? "", id),
      { reason: dto.reason },
    );
    return mapInterviewSession(unwrapApiData(response.data));
  }

  static async complete(
    id: string,
    dto: CompleteInterviewDto,
    applicationId?: string,
  ): Promise<InterviewSession> {
    if (isRecruitmentMockEnabled()) {
      return InterviewMockStore.complete(id, dto);
    }

    const response = await apiClient.post<ApiResponse<unknown>>(
      RECRUITMENT_API.interviewComplete(applicationId ?? "", id),
    );
    return mapInterviewSession(unwrapApiData(response.data));
  }

  static async saveEvaluationDraft(
    sessionId: string,
    dto: SaveEvaluationDraftDto,
  ): Promise<InterviewEvaluation> {
    if (isRecruitmentMockEnabled()) {
      throw new Error("Use panel-specific draft endpoint in mock mode");
    }

    const response = await apiClient.put<ApiResponse<InterviewEvaluation>>(
      RECRUITMENT_API.meEvaluationDraft(sessionId),
      dto,
    );
    return unwrapApiData(response.data);
  }

  static async saveMyEvaluationDraft(
    sessionId: string,
    panelMemberEmployeeId: string,
    dto: SaveEvaluationDraftDto,
  ): Promise<InterviewEvaluation> {
    if (isRecruitmentMockEnabled()) {
      return InterviewMockStore.saveEvaluationDraft(
        sessionId,
        panelMemberEmployeeId,
        dto,
      );
    }

    const response = await apiClient.put<ApiResponse<InterviewEvaluation>>(
      RECRUITMENT_API.meEvaluationDraft(sessionId),
      dto,
    );
    return unwrapApiData(response.data);
  }

  static async submitMyEvaluation(
    sessionId: string,
    panelMemberEmployeeId: string,
    dto: SubmitEvaluationDto,
  ): Promise<InterviewEvaluation> {
    if (isRecruitmentMockEnabled()) {
      return InterviewMockStore.submitEvaluation(
        sessionId,
        panelMemberEmployeeId,
        dto,
      );
    }

    const response = await apiClient.post<ApiResponse<InterviewEvaluation>>(
      RECRUITMENT_API.meEvaluationSubmit(sessionId),
      dto,
    );
    return unwrapApiData(response.data);
  }
}
