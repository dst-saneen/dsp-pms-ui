import { API_ENDPOINTS } from "@/config/api";
import { apiClient } from "@/services/api-client";
import type { ApiResponse } from "@/types/api-response";

import type {
  AssignOnboardingTaskRequest,
  CancelOnboardingRequest,
  CompleteOnboardingRequest,
  CompleteOnboardingTaskRequest,
  DepartmentOnboardingQueueQuery,
  EmployeeOnboardingTaskView,
  EmployeeOnboardingView,
  FulfillAssetOnboardingTaskRequest,
  MeOnboardingView,
  MyOnboardingTasksQuery,
  OnboardingAssigneeCandidateView,
  OnboardingAssetCandidateView,
  OnboardingCompletionPreflightView,
  OnboardingPreflightQuery,
  OnboardingPreflightView,
  OnboardingTaskHistoryItemView,
  OnboardingWorkspaceCapabilitiesView,
  OverrideStartEmployeeOnboardingRequest,
  PagedResult,
  ReopenOnboardingTaskRequest,
  ReopenTaskPreflightView,
  SkipOnboardingTaskRequest,
  StartEmployeeOnboardingRequest,
  StartOnboardingTaskRequest,
  UnassignOnboardingTaskRequest,
  EmployeeOnboardingTaskRuntimeView,
  WaiveOnboardingTaskRequest,
} from "../types/onboarding.types";

export class OnboardingApiService {
  static async getPreflight(
    params: OnboardingPreflightQuery,
  ): Promise<OnboardingPreflightView> {
    const response = await apiClient.get<
      ApiResponse<OnboardingPreflightView>
    >(API_ENDPOINTS.onboarding.preflight, { params });

    return response.data.data;
  }

  static async start(
    dto: StartEmployeeOnboardingRequest,
  ): Promise<EmployeeOnboardingView> {
    const response = await apiClient.post<
      ApiResponse<EmployeeOnboardingView>
    >(API_ENDPOINTS.onboarding.start, dto);

    return response.data.data;
  }

  static async overrideStart(
    dto: OverrideStartEmployeeOnboardingRequest,
  ): Promise<EmployeeOnboardingView> {
    const response = await apiClient.post<
      ApiResponse<EmployeeOnboardingView>
    >(API_ENDPOINTS.onboarding.overrideStart, dto);

    return response.data.data;
  }

  static async getCompletionPreflight(
    onboardingId: string,
  ): Promise<OnboardingCompletionPreflightView> {
    const response = await apiClient.get<
      ApiResponse<OnboardingCompletionPreflightView>
    >(API_ENDPOINTS.onboarding.completionPreflight(onboardingId));

    return response.data.data;
  }

  static async completeOnboarding(
    onboardingId: string,
    dto: CompleteOnboardingRequest,
  ): Promise<EmployeeOnboardingView> {
    const response = await apiClient.post<
      ApiResponse<EmployeeOnboardingView>
    >(API_ENDPOINTS.onboarding.complete(onboardingId), dto);

    return response.data.data;
  }

  static async cancelOnboarding(
    onboardingId: string,
    dto: CancelOnboardingRequest,
  ): Promise<EmployeeOnboardingView> {
    const response = await apiClient.post<
      ApiResponse<EmployeeOnboardingView>
    >(API_ENDPOINTS.onboarding.cancel(onboardingId), dto);

    return response.data.data;
  }

  static async getWorkspaceCapabilities(): Promise<OnboardingWorkspaceCapabilitiesView> {
    const response = await apiClient.get<
      ApiResponse<OnboardingWorkspaceCapabilitiesView>
    >(API_ENDPOINTS.onboarding.workspaceCapabilities);

    return response.data.data;
  }

  static async getMeOnboarding(): Promise<MeOnboardingView> {
    const response = await apiClient.get<ApiResponse<MeOnboardingView>>(
      API_ENDPOINTS.onboarding.me,
    );

    return response.data.data;
  }

  static async getMyTasks(
    params: MyOnboardingTasksQuery,
  ): Promise<PagedResult<EmployeeOnboardingTaskRuntimeView>> {
    const response = await apiClient.get<
      ApiResponse<PagedResult<EmployeeOnboardingTaskRuntimeView>>
    >(API_ENDPOINTS.onboarding.myTasks, { params });

    return response.data.data;
  }

  static async getDepartmentQueue(
    params: DepartmentOnboardingQueueQuery,
  ): Promise<PagedResult<EmployeeOnboardingTaskRuntimeView>> {
    const response = await apiClient.get<
      ApiResponse<PagedResult<EmployeeOnboardingTaskRuntimeView>>
    >(API_ENDPOINTS.onboarding.departmentQueue, { params });

    return response.data.data;
  }

  static async getTaskDetail(
    taskId: string,
  ): Promise<EmployeeOnboardingTaskView> {
    const response = await apiClient.get<
      ApiResponse<EmployeeOnboardingTaskView>
    >(API_ENDPOINTS.onboarding.taskDetail(taskId));

    return response.data.data;
  }

  static async getAssigneeCandidates(
    taskId: string,
    params?: { keyword?: string; page?: number; limit?: number },
  ): Promise<PagedResult<OnboardingAssigneeCandidateView>> {
    const response = await apiClient.get<
      ApiResponse<PagedResult<OnboardingAssigneeCandidateView>>
    >(API_ENDPOINTS.onboarding.assigneeCandidates(taskId), { params });

    return response.data.data;
  }

  static async getAssetCandidates(
    taskId: string,
    params?: { keyword?: string; page?: number; limit?: number },
  ): Promise<PagedResult<OnboardingAssetCandidateView>> {
    const response = await apiClient.get<
      ApiResponse<PagedResult<OnboardingAssetCandidateView>>
    >(API_ENDPOINTS.onboarding.assetCandidates(taskId), { params });

    return response.data.data;
  }

  static async getReopenPreflight(
    taskId: string,
  ): Promise<ReopenTaskPreflightView> {
    const response = await apiClient.get<
      ApiResponse<ReopenTaskPreflightView>
    >(API_ENDPOINTS.onboarding.reopenPreflight(taskId));

    return response.data.data;
  }

  static async getTaskHistory(
    taskId: string,
    params: { page: number; limit: number; sortOrder?: "asc" | "desc" },
  ): Promise<PagedResult<OnboardingTaskHistoryItemView>> {
    const response = await apiClient.get<
      ApiResponse<PagedResult<OnboardingTaskHistoryItemView>>
    >(API_ENDPOINTS.onboarding.taskHistory(taskId), { params });

    return response.data.data;
  }

  static async assignTask(
    taskId: string,
    dto: AssignOnboardingTaskRequest,
  ): Promise<EmployeeOnboardingTaskRuntimeView> {
    const response = await apiClient.post<
      ApiResponse<EmployeeOnboardingTaskRuntimeView>
    >(API_ENDPOINTS.onboarding.assignTask(taskId), dto);

    return response.data.data;
  }

  static async unassignTask(
    taskId: string,
    dto: UnassignOnboardingTaskRequest,
  ): Promise<EmployeeOnboardingTaskRuntimeView> {
    const response = await apiClient.post<
      ApiResponse<EmployeeOnboardingTaskRuntimeView>
    >(API_ENDPOINTS.onboarding.unassignTask(taskId), dto);

    return response.data.data;
  }

  static async startTask(
    taskId: string,
    dto: StartOnboardingTaskRequest,
  ): Promise<EmployeeOnboardingTaskRuntimeView> {
    const response = await apiClient.post<
      ApiResponse<EmployeeOnboardingTaskRuntimeView>
    >(API_ENDPOINTS.onboarding.startTask(taskId), dto);

    return response.data.data;
  }

  static async completeTask(
    taskId: string,
    dto: CompleteOnboardingTaskRequest,
  ): Promise<EmployeeOnboardingTaskRuntimeView> {
    const response = await apiClient.post<
      ApiResponse<EmployeeOnboardingTaskRuntimeView>
    >(API_ENDPOINTS.onboarding.completeTask(taskId), dto);

    return response.data.data;
  }

  static async skipTask(
    taskId: string,
    dto: SkipOnboardingTaskRequest,
  ): Promise<EmployeeOnboardingTaskRuntimeView> {
    const response = await apiClient.post<
      ApiResponse<EmployeeOnboardingTaskRuntimeView>
    >(API_ENDPOINTS.onboarding.skipTask(taskId), dto);

    return response.data.data;
  }

  static async reopenTask(
    taskId: string,
    dto: ReopenOnboardingTaskRequest,
  ): Promise<EmployeeOnboardingTaskRuntimeView> {
    const response = await apiClient.post<
      ApiResponse<EmployeeOnboardingTaskRuntimeView>
    >(API_ENDPOINTS.onboarding.reopenTask(taskId), dto);

    return response.data.data;
  }

  static async fulfillAsset(
    taskId: string,
    dto: FulfillAssetOnboardingTaskRequest,
  ): Promise<EmployeeOnboardingTaskRuntimeView> {
    const response = await apiClient.post<
      ApiResponse<EmployeeOnboardingTaskRuntimeView>
    >(API_ENDPOINTS.onboarding.fulfillAsset(taskId), dto);

    return response.data.data;
  }

  static async waiveTask(
    taskId: string,
    dto: WaiveOnboardingTaskRequest,
  ): Promise<EmployeeOnboardingTaskRuntimeView> {
    const response = await apiClient.post<
      ApiResponse<EmployeeOnboardingTaskRuntimeView>
    >(API_ENDPOINTS.onboarding.waiveTask(taskId), dto);

    return response.data.data;
  }
}
