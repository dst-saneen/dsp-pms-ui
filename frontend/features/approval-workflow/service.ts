import { API_ENDPOINTS } from "@/config/api";
import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api";

import type {
  ApprovalWorkflow,
  ApprovalWorkflowStep,
  CreateApprovalWorkflowInput,
  CreateApprovalWorkflowStepInput,
} from "./types";

export class ApprovalWorkflowApiService {
  static async list() {
    const response = await apiClient.get<ApiResponse<ApprovalWorkflow[]>>(
      API_ENDPOINTS.approvalWorkflows.list,
    );
    return unwrapApiData(response.data);
  }

  static async create(input: CreateApprovalWorkflowInput) {
    const response = await apiClient.post<ApiResponse<ApprovalWorkflow>>(
      API_ENDPOINTS.approvalWorkflows.list,
      input,
    );
    return unwrapApiData(response.data);
  }

  static async createStep(input: CreateApprovalWorkflowStepInput) {
    const response = await apiClient.post<ApiResponse<ApprovalWorkflowStep>>(
      API_ENDPOINTS.approvalWorkflows.steps,
      input,
    );
    return unwrapApiData(response.data);
  }
}
