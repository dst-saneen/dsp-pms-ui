import { API_ENDPOINTS } from "@/config/api";
import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api";
import type { UploadSessionResponse } from "@/components/file-upload/secure-file-upload-field";

import type {
  ClearanceCommandInput,
  ClearanceDepartmentCandidate,
  CreateEmployeeSeparationInput,
  CreateHrRequestInput,
  CreateHrRequestTypeInput,
  EmployeeClearanceItem,
  EmployeeSeparation,
  HrRequest,
  HrRequestAction,
  HrRequestCollectionAction,
  HrRequestCommandInput,
  HrRequestFilters,
  HrRequestType,
  HrRequestTypeAction,
  HrRequestWorkflowCandidate,
  PageResult,
  SeparationAction,
  SeparationCollectionAction,
  SeparationCommandInput,
  SeparationFilters,
  UpdateHrRequestTypeInput,
} from "../types";

export class HrOperationsApiService {
  static async listRequestTypes() {
    const response = await apiClient.get<ApiResponse<PageResult<HrRequestType, HrRequestTypeAction>>>(
      API_ENDPOINTS.hrRequests.types,
    );
    return unwrapApiData(response.data);
  }

  static async createRequestType(input: CreateHrRequestTypeInput) {
    const response = await apiClient.post<ApiResponse<HrRequestType>>(
      API_ENDPOINTS.hrRequests.types,
      input,
    );
    return unwrapApiData(response.data);
  }

  static async listWorkflowCandidates() {
    const response = await apiClient.get<ApiResponse<HrRequestWorkflowCandidate[]>>(
      API_ENDPOINTS.hrRequests.workflowCandidates,
    );
    return unwrapApiData(response.data);
  }

  static async createRequestUploadSession(params: {
    fileName: string;
    declaredMimeType: string;
    sizeBytes: number;
    checksumSha256: string;
    operationId: string;
  }): Promise<UploadSessionResponse> {
    const response = await apiClient.post<ApiResponse<UploadSessionResponse>>(
      API_ENDPOINTS.hrRequests.uploadSessions,
      params,
    );
    return unwrapApiData(response.data);
  }

  static async finalizeRequestUploadSession(
    sessionId: string,
    sessionToken?: string,
  ): Promise<UploadSessionResponse> {
    const response = await apiClient.post<ApiResponse<UploadSessionResponse>>(
      API_ENDPOINTS.fileUploadSessions.finalize(sessionId),
      {},
      { headers: sessionToken ? { "X-File-Session-Token": sessionToken } : undefined },
    );
    return unwrapApiData(response.data);
  }

  static async pollRequestUploadSession(
    sessionId: string,
    sessionToken?: string,
  ): Promise<UploadSessionResponse> {
    const response = await apiClient.get<ApiResponse<UploadSessionResponse>>(
      API_ENDPOINTS.fileUploadSessions.detail(sessionId),
      { headers: sessionToken ? { "X-File-Session-Token": sessionToken } : undefined },
    );
    return unwrapApiData(response.data);
  }

  static async updateRequestType(id: string, input: UpdateHrRequestTypeInput) {
    const response = await apiClient.patch<ApiResponse<HrRequestType>>(
      API_ENDPOINTS.hrRequests.type(id),
      input,
    );
    return unwrapApiData(response.data);
  }

  static async archiveRequestType(id: string) {
    const response = await apiClient.delete<ApiResponse<HrRequestType>>(
      API_ENDPOINTS.hrRequests.type(id),
    );
    return unwrapApiData(response.data);
  }

  static async listRequests(filters?: HrRequestFilters) {
    const response = await apiClient.get<ApiResponse<PageResult<HrRequest, HrRequestAction | HrRequestCollectionAction>>>(
      API_ENDPOINTS.hrRequests.list,
      { params: filters },
    );
    return unwrapApiData(response.data);
  }

  static async listAllRequests(
    filters?: Omit<HrRequestFilters, "page" | "limit">,
  ) {
    const items: HrRequest[] = [];
    let page = 1;
    let total = 0;
    let allowedActions: Array<HrRequestAction | HrRequestCollectionAction> = [];

    do {
      const result = await this.listRequests({
        ...filters,
        page,
        limit: 100,
      });
      if (page === 1) allowedActions = result.allowedActions ?? [];
      total = result.total;
      items.push(...result.items);
      if (result.items.length === 0) break;
      page += 1;
    } while (items.length < total);

    return {
      items,
      total,
      page: 1,
      limit: 100,
      allowedActions,
    } satisfies PageResult<
      HrRequest,
      HrRequestAction | HrRequestCollectionAction
    >;
  }

  static async getRequest(id: string) {
    const response = await apiClient.get<ApiResponse<HrRequest>>(
      API_ENDPOINTS.hrRequests.detail(id),
    );
    return unwrapApiData(response.data);
  }

  static async createRequest(input: CreateHrRequestInput) {
    const response = await apiClient.post<ApiResponse<HrRequest>>(
      API_ENDPOINTS.hrRequests.list,
      input,
    );
    return unwrapApiData(response.data);
  }

  static async listPendingRequestApprovals() {
    const response = await apiClient.get<ApiResponse<PageResult<HrRequest, HrRequestAction>>>(
      API_ENDPOINTS.hrRequests.pendingApprovals,
    );
    return unwrapApiData(response.data);
  }

  static async requestCommand(
    id: string,
    action: Lowercase<HrRequestAction>,
    input: HrRequestCommandInput,
  ) {
    const response = await apiClient.post<ApiResponse<HrRequest>>(
      API_ENDPOINTS.hrRequests.command(id, action),
      input,
    );
    return unwrapApiData(response.data);
  }

  static async createRequestAttachmentDownloadGrant(id: string) {
    const response = await apiClient.post<
      ApiResponse<{ url: string; expiresAt: string; fileName: string }>
    >(API_ENDPOINTS.hrRequests.attachmentDownloadGrant(id));
    return unwrapApiData(response.data);
  }

  static async listSeparations(filters?: SeparationFilters) {
    const response = await apiClient.get<ApiResponse<PageResult<EmployeeSeparation, SeparationAction | SeparationCollectionAction>>>(
      API_ENDPOINTS.separations.list,
      { params: filters },
    );
    return unwrapApiData(response.data);
  }

  static async getSeparation(id: string) {
    const response = await apiClient.get<ApiResponse<EmployeeSeparation>>(
      API_ENDPOINTS.separations.detail(id),
    );
    return unwrapApiData(response.data);
  }

  static async createSeparation(input: CreateEmployeeSeparationInput) {
    const response = await apiClient.post<ApiResponse<EmployeeSeparation>>(
      API_ENDPOINTS.separations.list,
      input,
    );
    return unwrapApiData(response.data);
  }

  static async getClearanceDepartmentCandidates(employeeId: string) {
    const response = await apiClient.get<ApiResponse<ClearanceDepartmentCandidate[]>>(
      API_ENDPOINTS.separations.clearanceDepartmentCandidates,
      { params: { employeeId } },
    );
    return unwrapApiData(response.data);
  }

  static async listPendingSeparationApprovals() {
    const response = await apiClient.get<ApiResponse<PageResult<EmployeeSeparation, SeparationAction>>>(
      API_ENDPOINTS.separations.pendingApprovals,
    );
    return unwrapApiData(response.data);
  }

  static async separationCommand(
    id: string,
    action: Lowercase<SeparationAction>,
    input: SeparationCommandInput,
  ) {
    const response = await apiClient.post<ApiResponse<EmployeeSeparation>>(
      API_ENDPOINTS.separations.command(id, action),
      input,
    );
    return unwrapApiData(response.data);
  }

  static async listClearanceQueue() {
    const items: EmployeeClearanceItem[] = [];
    let page = 1;
    let total = 0;

    do {
      const response = await apiClient.get<ApiResponse<PageResult<EmployeeClearanceItem>>>(
        API_ENDPOINTS.clearance.list,
        { params: { queue: "mine", page, limit: 100 } },
      );
      const result = unwrapApiData(response.data);
      total = result.total;
      items.push(...result.items);
      if (result.items.length === 0) break;
      page += 1;
    } while (items.length < total);

    return { items, total, page: 1, limit: 100 } satisfies PageResult<EmployeeClearanceItem>;
  }

  static async clearanceCommand(
    itemId: string,
    action: "clear" | "reopen",
    input: ClearanceCommandInput,
  ) {
    const response = await apiClient.post<ApiResponse<EmployeeClearanceItem>>(
      API_ENDPOINTS.clearance.command(itemId, action),
      input,
    );
    return unwrapApiData(response.data);
  }
}
