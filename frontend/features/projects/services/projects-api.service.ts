import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api";

import { createOperationId } from "../lib/allowed-actions";
import type {
  ActivationPreflight,
  EligibilityCandidate,
  Paginated,
  ProjectDetail,
  ProjectFinanceSummary,
  ProjectStage,
  ProjectSummary,
  ProjectTask,
  ProjectTaskDetail,
  ProjectTeamMember,
  ProjectTimeSummary,
  VersionedCommand,
  WorkspaceCapabilities,
} from "../types/project.types";

export class ProjectsApiService {
  static async getWorkspaceCapabilities(): Promise<WorkspaceCapabilities> {
    const response = await apiClient.get<ApiResponse<WorkspaceCapabilities>>(
      "/projects/workspace-capabilities",
    );
    return unwrapApiData(response.data);
  }

  static async getManagerCandidates(
    keyword?: string,
  ): Promise<EligibilityCandidate[]> {
    const response = await apiClient.get<ApiResponse<EligibilityCandidate[]>>(
      "/projects/manager-candidates",
      { params: { keyword } },
    );
    return unwrapApiData(response.data);
  }

  static async getActivationPreflight(
    id: string,
  ): Promise<ActivationPreflight> {
    const response = await apiClient.get<ApiResponse<ActivationPreflight>>(
      `/projects/${id}/activation-preflight`,
    );
    return unwrapApiData(response.data);
  }

  static async list(params?: {
    keyword?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<Paginated<ProjectDetail>> {
    const response = await apiClient.get<ApiResponse<Paginated<ProjectDetail>>>(
      "/projects",
      {
        params,
      },
    );
    return unwrapApiData(response.data);
  }

  static async get(id: string): Promise<ProjectDetail> {
    const response = await apiClient.get<ApiResponse<ProjectDetail>>(
      `/projects/${id}`,
    );
    return unwrapApiData(response.data);
  }

  static async create(body: {
    projectName: string;
    projectType: "CLIENT" | "INTERNAL";
    projectManagerId?: string;
    branchId?: string;
    businessPartyId?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    expectedIncome?: string;
    expenseBudget?: string;
    operationId?: string;
  }): Promise<ProjectDetail> {
    const response = await apiClient.post<ApiResponse<ProjectDetail>>(
      "/projects",
      {
        ...body,
        operationId: body.operationId || createOperationId(),
      },
    );
    return unwrapApiData(response.data);
  }

  static async update(
    id: string,
    body: {
      expectedVersion: number;
      operationId?: string;
      projectName?: string;
      description?: string | null;
      projectManagerId?: string | null;
      branchId?: string | null;
      businessPartyId?: string | null;
      startDate?: string | null;
      endDate?: string | null;
      expectedIncome?: string | null;
      expenseBudget?: string | null;
    },
  ): Promise<ProjectDetail> {
    const response = await apiClient.patch<ApiResponse<ProjectDetail>>(
      `/projects/${id}`,
      {
        ...body,
        operationId: body.operationId || createOperationId(),
      },
    );
    return unwrapApiData(response.data);
  }

  static async command(
    id: string,
    action: "activate" | "hold" | "resume" | "complete" | "cancel" | "archive",
    body: VersionedCommand,
  ): Promise<ProjectDetail> {
    const response = await apiClient.post<ApiResponse<ProjectDetail>>(
      `/projects/${id}/${action}`,
      {
        ...body,
        operationId: body.operationId || createOperationId(),
      },
    );
    return unwrapApiData(response.data);
  }

  static async listStages(projectId: string): Promise<ProjectStage[]> {
    const response = await apiClient.get<ApiResponse<ProjectStage[]>>(
      `/projects/${projectId}/stages`,
    );
    return unwrapApiData(response.data);
  }

  static async listTeam(projectId: string): Promise<ProjectTeamMember[]> {
    const response = await apiClient.get<ApiResponse<ProjectTeamMember[]>>(
      `/projects/${projectId}/team`,
    );
    return unwrapApiData(response.data);
  }

  static async listTasks(projectId: string): Promise<ProjectTask[]> {
    const response = await apiClient.get<ApiResponse<ProjectTask[]>>(
      `/projects/${projectId}/tasks`,
    );
    return unwrapApiData(response.data);
  }

  static async getTask(
    projectId: string,
    taskId: string,
  ): Promise<ProjectTaskDetail> {
    const response = await apiClient.get<ApiResponse<ProjectTaskDetail>>(
      `/projects/${projectId}/tasks/${taskId}`,
    );
    return unwrapApiData(response.data);
  }

  static async getMyTask(taskId: string): Promise<ProjectTaskDetail> {
    const response = await apiClient.get<ApiResponse<ProjectTaskDetail>>(
      `/me/project-tasks/${taskId}`,
    );
    return unwrapApiData(response.data);
  }

  static async taskCommand(
    projectId: string,
    taskId: string,
    action: "start" | "submit-review" | "return" | "complete" | "cancel",
    body: VersionedCommand,
  ): Promise<ProjectTask> {
    const response = await apiClient.post<ApiResponse<ProjectTask>>(
      `/projects/${projectId}/tasks/${taskId}/${action}`,
      {
        ...body,
        operationId: body.operationId || createOperationId(),
      },
    );
    return unwrapApiData(response.data);
  }

  static async assignTask(
    projectId: string,
    taskId: string,
    body: VersionedCommand & {
      employeeId: string;
      role: string;
      plannedHours?: string;
    },
  ): Promise<ProjectTask> {
    const response = await apiClient.post<ApiResponse<ProjectTask>>(
      `/projects/${projectId}/tasks/${taskId}/assign`,
      {
        ...body,
        operationId: body.operationId || createOperationId(),
      },
    );
    return unwrapApiData(response.data);
  }

  static async reassignTask(
    projectId: string,
    taskId: string,
    body: VersionedCommand & {
      employeeId: string;
      role: string;
      plannedHours?: string;
      reason?: string;
    },
  ): Promise<ProjectTask> {
    const response = await apiClient.post<ApiResponse<ProjectTask>>(
      `/projects/${projectId}/tasks/${taskId}/reassign`,
      {
        ...body,
        operationId: body.operationId || createOperationId(),
      },
    );
    return unwrapApiData(response.data);
  }

  static async unassignTask(
    projectId: string,
    taskId: string,
    body: VersionedCommand & { employeeId?: string; reason?: string },
  ): Promise<ProjectTask> {
    const response = await apiClient.post<ApiResponse<ProjectTask>>(
      `/projects/${projectId}/tasks/${taskId}/unassign`,
      {
        ...body,
        operationId: body.operationId || createOperationId(),
      },
    );
    return unwrapApiData(response.data);
  }

  static async memberCandidates(
    projectId: string,
    keyword?: string,
  ): Promise<EligibilityCandidate[]> {
    const response = await apiClient.get<ApiResponse<EligibilityCandidate[]>>(
      `/projects/${projectId}/member-candidates`,
      { params: { keyword } },
    );
    return unwrapApiData(response.data);
  }

  static async assigneeCandidates(
    projectId: string,
    taskId: string,
    keyword?: string,
  ): Promise<EligibilityCandidate[]> {
    const response = await apiClient.get<ApiResponse<EligibilityCandidate[]>>(
      `/projects/${projectId}/tasks/${taskId}/assignee-candidates`,
      { params: { keyword } },
    );
    return unwrapApiData(response.data);
  }

  static async addTeamMember(
    projectId: string,
    body: {
      employeeId: string;
      role: string;
      allocationPercentage?: string;
      operationId?: string;
    },
  ): Promise<ProjectTeamMember> {
    const response = await apiClient.post<ApiResponse<ProjectTeamMember>>(
      `/projects/${projectId}/team`,
      {
        ...body,
        operationId: body.operationId || createOperationId(),
      },
    );
    return unwrapApiData(response.data);
  }

  static async createStage(
    projectId: string,
    body: {
      stageCode?: string;
      stageName: string;
      sequenceNo: number;
      description?: string;
      operationId?: string;
    },
  ): Promise<ProjectStage> {
    const response = await apiClient.post<ApiResponse<ProjectStage>>(
      `/projects/${projectId}/stages`,
      {
        ...body,
        operationId: body.operationId || createOperationId(),
      },
    );
    return unwrapApiData(response.data);
  }

  static async updateStage(
    projectId: string,
    stageId: string,
    body: VersionedCommand & {
      stageName?: string;
      description?: string | null;
      sequenceNo?: number;
      startDate?: string | null;
      endDate?: string | null;
    },
  ): Promise<ProjectStage> {
    const response = await apiClient.patch<ApiResponse<ProjectStage>>(
      `/projects/${projectId}/stages/${stageId}`,
      {
        ...body,
        operationId: body.operationId || createOperationId(),
      },
    );
    return unwrapApiData(response.data);
  }

  static async stageCommand(
    projectId: string,
    stageId: string,
    action: "activate" | "complete" | "cancel",
    body: VersionedCommand,
  ): Promise<ProjectStage> {
    const response = await apiClient.post<ApiResponse<ProjectStage>>(
      `/projects/${projectId}/stages/${stageId}/${action}`,
      {
        ...body,
        operationId: body.operationId || createOperationId(),
      },
    );
    return unwrapApiData(response.data);
  }

  static async updateTeamMember(
    projectId: string,
    memberId: string,
    body: VersionedCommand & {
      role?: string;
      allocationPercentage?: string;
      startDate?: string | null;
      endDate?: string | null;
    },
  ): Promise<ProjectTeamMember> {
    const response = await apiClient.patch<ApiResponse<ProjectTeamMember>>(
      `/projects/${projectId}/team/${memberId}`,
      {
        ...body,
        operationId: body.operationId || createOperationId(),
      },
    );
    return unwrapApiData(response.data);
  }

  static async endTeamMember(
    projectId: string,
    memberId: string,
    body: VersionedCommand & { reason: string },
  ): Promise<ProjectTeamMember> {
    const response = await apiClient.post<ApiResponse<ProjectTeamMember>>(
      `/projects/${projectId}/team/${memberId}/end`,
      {
        ...body,
        operationId: body.operationId || createOperationId(),
      },
    );
    return unwrapApiData(response.data);
  }

  static async createTask(
    projectId: string,
    body: {
      stageId: string;
      taskCode?: string;
      taskName: string;
      description?: string;
      plannedHours?: string;
      dueDate?: string;
      operationId?: string;
    },
  ): Promise<ProjectTask> {
    const response = await apiClient.post<ApiResponse<ProjectTask>>(
      `/projects/${projectId}/tasks`,
      {
        ...body,
        operationId: body.operationId || createOperationId(),
      },
    );
    return unwrapApiData(response.data);
  }

  static async createTaskUploadSession(
    projectId: string,
    taskId: string,
    body: {
      fileName: string;
      declaredMimeType: string;
      sizeBytes: number;
      checksumSha256: string;
      operationId: string;
    },
  ) {
    const response = await apiClient.post(
      `/projects/${projectId}/tasks/${taskId}/upload-sessions`,
      body,
    );
    return unwrapApiData(response.data);
  }

  static async linkTaskDocument(
    projectId: string,
    taskId: string,
    body: { uploadSessionId: string; title?: string; operationId: string },
  ) {
    const response = await apiClient.post(
      `/projects/${projectId}/tasks/${taskId}/attachments`,
      body,
    );
    return unwrapApiData(response.data);
  }

  static async downloadTaskDocument(
    projectId: string,
    taskId: string,
    attachmentId: string,
  ): Promise<{ url: string; fileName: string; expiresAt: string }> {
    const response = await apiClient.post<
      ApiResponse<{ url: string; fileName: string; expiresAt: string }>
    >(
      `/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}/download-grant`,
    );
    return unwrapApiData(response.data);
  }

  static async getSummary(projectId: string): Promise<ProjectSummary> {
    const response = await apiClient.get<ApiResponse<ProjectSummary>>(
      `/projects/${projectId}/summary`,
    );
    return unwrapApiData(response.data);
  }

  static async getTimeSummary(projectId: string): Promise<ProjectTimeSummary> {
    const response = await apiClient.get<ApiResponse<ProjectTimeSummary>>(
      `/projects/${projectId}/time-summary`,
    );
    return unwrapApiData(response.data);
  }

  static async getFinanceSummary(
    projectId: string,
  ): Promise<ProjectFinanceSummary> {
    const response = await apiClient.get<ApiResponse<ProjectFinanceSummary>>(
      `/projects/${projectId}/finance-summary`,
    );
    return unwrapApiData(response.data);
  }

  static async listMyTasks(): Promise<Paginated<ProjectTask>> {
    const response =
      await apiClient.get<ApiResponse<Paginated<ProjectTask>>>(
        "/me/project-tasks",
      );
    return unwrapApiData(response.data);
  }
}
