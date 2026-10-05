import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api-response";

import { isRecruitmentMockEnabled } from "../../constants/feature-flags";
import { RECRUITMENT_API, RECRUITMENT_LIST_LIMIT } from "../../constants/api-routes";
import {
  mapCandidate,
  mapJobApplication,
  unwrapPagedItems,
  unwrapPagedResult,
} from "../../utils/api-mappers";
import type { Candidate, CandidateSearch } from "../../candidates/types/candidate";
import { RecruitmentPipelineMockStore } from "../mocks/recruitment-pipeline-mock-store";
import type {
  ApplicationTransitionDto,
  CreateInternalApplicationDto,
  JobApplication,
  JobApplicationPagedResult,
  JobApplicationSearch,
} from "../types/job-application";

export class CandidateService {
  static async getAll(filters?: CandidateSearch): Promise<Candidate[]> {
    if (isRecruitmentMockEnabled()) {
      return RecruitmentPipelineMockStore.listCandidates(filters);
    }

    const response = await apiClient.get<ApiResponse<unknown>>(
      RECRUITMENT_API.candidates,
      { params: { ...filters, page: 1, limit: RECRUITMENT_LIST_LIMIT } },
    );
    return unwrapPagedItems(unwrapApiData(response.data)).map(mapCandidate);
  }

  static async getById(id: string): Promise<Candidate> {
    if (isRecruitmentMockEnabled()) {
      const candidate = RecruitmentPipelineMockStore.getCandidate(id);
      if (!candidate) throw new Error("NOT_FOUND");
      return candidate;
    }

    const response = await apiClient.get<ApiResponse<unknown>>(
      RECRUITMENT_API.candidate(id),
    );
    return mapCandidate(unwrapApiData(response.data));
  }
}

export class JobApplicationService {
  static async getAll(
    filters?: JobApplicationSearch,
  ): Promise<JobApplicationPagedResult> {
    if (isRecruitmentMockEnabled()) {
      return RecruitmentPipelineMockStore.listApplicationsPaged(filters);
    }

    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit =
      filters?.limit && filters.limit > 0
        ? Math.min(filters.limit, RECRUITMENT_LIST_LIMIT)
        : 20;

    const response = await apiClient.get<ApiResponse<unknown>>(
      RECRUITMENT_API.applications,
      {
        params: {
          ...filters,
          page,
          limit,
        },
      },
    );
    const paged = unwrapPagedResult(unwrapApiData(response.data));
    return {
      items: paged.items.map(mapJobApplication),
      total: paged.total,
      page: paged.page,
      limit: paged.limit,
    };
  }

  static async getById(id: string): Promise<JobApplication> {
    if (isRecruitmentMockEnabled()) {
      const application = RecruitmentPipelineMockStore.getApplication(id);
      if (!application) throw new Error("NOT_FOUND");
      return application;
    }

    const response = await apiClient.get<ApiResponse<unknown>>(
      RECRUITMENT_API.application(id),
    );
    return mapJobApplication(unwrapApiData(response.data));
  }

  static async getByCandidate(candidateId: string): Promise<JobApplication[]> {
    if (isRecruitmentMockEnabled()) {
      return RecruitmentPipelineMockStore.listCandidateApplications(candidateId);
    }

    const response = await apiClient.get<ApiResponse<unknown>>(
      RECRUITMENT_API.applications,
      { params: { candidateId, page: 1, limit: RECRUITMENT_LIST_LIMIT } },
    );
    return unwrapPagedItems(unwrapApiData(response.data)).map(mapJobApplication);
  }

  static async createInternal(
    dto: CreateInternalApplicationDto,
  ): Promise<JobApplication> {
    if (isRecruitmentMockEnabled()) {
      return RecruitmentPipelineMockStore.createInternalApplication({
        ...dto,
        cvFileName: dto.cvFile?.name,
      });
    }

    const formData = new FormData();
    formData.append("jobOpeningId", dto.jobOpeningId);
    formData.append("firstName", dto.firstName);
    formData.append("lastName", dto.lastName);
    formData.append("email", dto.email);
    if (dto.mobile) formData.append("mobile", dto.mobile);
    if (dto.coverNote) formData.append("coverNote", dto.coverNote);
    formData.append("source", "HR_INTERNAL");
    if (dto.cvFile) formData.append("cv", dto.cvFile);

    const response = await apiClient.post<ApiResponse<unknown>>(
      RECRUITMENT_API.candidateIntake,
      formData,
    );
    return mapJobApplication(unwrapApiData(response.data));
  }

  static async shortlist(
    id: string,
    dto: ApplicationTransitionDto,
  ): Promise<JobApplication> {
    if (isRecruitmentMockEnabled()) {
      return RecruitmentPipelineMockStore.startScreening(id, dto);
    }

    const response = await apiClient.post<ApiResponse<unknown>>(
      RECRUITMENT_API.applicationShortlist(id),
      dto,
    );
    return mapJobApplication(unwrapApiData(response.data));
  }

  static async startScreening(
    id: string,
    dto: ApplicationTransitionDto,
  ): Promise<JobApplication> {
    if (isRecruitmentMockEnabled()) {
      return RecruitmentPipelineMockStore.startScreening(id, dto);
    }

    const response = await apiClient.post<ApiResponse<unknown>>(
      RECRUITMENT_API.applicationStartScreening(id),
      dto,
    );
    return mapJobApplication(unwrapApiData(response.data));
  }

  static async advanceToInterview(
    id: string,
    dto: ApplicationTransitionDto,
  ): Promise<JobApplication> {
    if (isRecruitmentMockEnabled()) {
      return RecruitmentPipelineMockStore.advanceToInterview(id, dto);
    }

    const response = await apiClient.post<ApiResponse<unknown>>(
      RECRUITMENT_API.applicationAdvanceInterview(id),
      dto,
    );
    return mapJobApplication(unwrapApiData(response.data));
  }

  static async advanceToManagerReview(
    id: string,
    dto: ApplicationTransitionDto,
  ): Promise<JobApplication> {
    if (isRecruitmentMockEnabled()) {
      return RecruitmentPipelineMockStore.advanceToManagerReview(id, dto);
    }

    const response = await apiClient.post<ApiResponse<unknown>>(
      RECRUITMENT_API.applicationAdvanceManager(id),
      dto,
    );
    return mapJobApplication(unwrapApiData(response.data));
  }

  static async reject(
    id: string,
    dto: ApplicationTransitionDto,
  ): Promise<JobApplication> {
    if (isRecruitmentMockEnabled()) {
      return RecruitmentPipelineMockStore.reject(id, dto);
    }

    const response = await apiClient.post<ApiResponse<unknown>>(
      RECRUITMENT_API.applicationReject(id),
      dto,
    );
    return mapJobApplication(unwrapApiData(response.data));
  }

  static async withdraw(
    id: string,
    dto: ApplicationTransitionDto,
  ): Promise<JobApplication> {
    if (isRecruitmentMockEnabled()) {
      return RecruitmentPipelineMockStore.withdraw(id, dto);
    }

    const response = await apiClient.post<ApiResponse<unknown>>(
      RECRUITMENT_API.applicationWithdraw(id),
      dto,
    );
    return mapJobApplication(unwrapApiData(response.data));
  }
}
