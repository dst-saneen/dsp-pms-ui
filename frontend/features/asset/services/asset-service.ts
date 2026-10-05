import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api";

import { createOperationId } from "../lib/operation-id";
import { unwrapPage } from "../lib/kind-tracking";
import type {
  ArchiveAssetDto,
  Asset,
  AssetDepartmentOption,
  AssetInventorySummary,
  AssetListQuery,
  CreateAssetDto,
  CustodyRequest,
  PaginatedAssets,
  PaginatedCustodyRequests,
  UpdateAssetDto,
} from "../types/asset";

function toIsoDate(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  return null;
}

function mapAsset(raw: Asset): Asset {
  return {
    ...raw,
    kind: raw.kind ?? "GENERAL",
    trackingMode: raw.trackingMode ?? "INDIVIDUAL",
    lifecycleStatus: raw.lifecycleStatus ?? "IN_SERVICE",
    version: raw.version ?? 1,
    allowedActions: raw.allowedActions ?? ["READ"],
    purchaseDate: toIsoDate(raw.purchaseDate) ?? raw.purchaseDate,
    warrantyExpiry: toIsoDate(raw.warrantyExpiry) ?? raw.warrantyExpiry,
    departmentId: raw.departmentId ?? raw.department?.id ?? null,
  };
}

export class AssetService {
  static async getAll(query: AssetListQuery = {}): Promise<PaginatedAssets> {
    const response = await apiClient.get<ApiResponse<PaginatedAssets | Asset[]>>(
      "/asset",
      { params: query },
    );
    const page = unwrapPage(unwrapApiData(response.data));
    return {
      ...page,
      items: page.items.map(mapAsset),
    };
  }

  static async summarize(): Promise<AssetInventorySummary> {
    const response = await apiClient.get<ApiResponse<AssetInventorySummary>>(
      "/asset/summary",
    );
    return unwrapApiData(response.data);
  }

  static async getById(id: string): Promise<Asset> {
    const response = await apiClient.get<ApiResponse<Asset>>(`/asset/${id}`);
    return mapAsset(unwrapApiData(response.data));
  }

  static async create(dto: CreateAssetDto): Promise<Asset> {
    const response = await apiClient.post<ApiResponse<Asset>>("/asset", {
      ...dto,
      operationId: dto.operationId || createOperationId(),
    });
    return mapAsset(unwrapApiData(response.data));
  }

  static async update(id: string, dto: UpdateAssetDto): Promise<Asset> {
    const response = await apiClient.patch<ApiResponse<Asset>>(`/asset/${id}`, {
      ...dto,
      operationId: dto.operationId || createOperationId(),
    });
    return mapAsset(unwrapApiData(response.data));
  }

  static async archive(id: string, dto: ArchiveAssetDto): Promise<Asset> {
    const response = await apiClient.post<ApiResponse<Asset>>(
      `/asset/${id}/archive`,
      {
        ...dto,
        operationId: dto.operationId || createOperationId(),
      },
    );
    return mapAsset(unwrapApiData(response.data));
  }

  static async delete(id: string): Promise<Asset> {
    return this.archive(id, {
      operationId: createOperationId(),
      expectedVersion: 1,
      reason: "Compatibility archive",
    });
  }

  static async getGrantedDepartments(): Promise<AssetDepartmentOption[]> {
    const response = await apiClient.get<ApiResponse<AssetDepartmentOption[]>>(
      "/me/asset-departments",
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async getCustodyRequests(query: {
    page?: number;
    limit?: number;
    status?: string;
  } = {}): Promise<PaginatedCustodyRequests> {
    const response = await apiClient.get<
      ApiResponse<PaginatedCustodyRequests | CustodyRequest[]>
    >("/asset-custody-requests", { params: query });
    return unwrapPage(unwrapApiData(response.data));
  }

  static async completeCustodyRequest(
    id: string,
    dto: {
      operationId: string;
      expectedRequestVersion: number;
      expectedTargetVersion: number;
      expectedAssetVersion: number;
      effectiveDate: string;
      resolutionNote?: string;
    },
  ): Promise<CustodyRequest> {
    const response = await apiClient.post<ApiResponse<CustodyRequest>>(
      `/asset-custody-requests/${id}/complete`,
      dto,
    );
    return unwrapApiData(response.data);
  }

  static async rejectCustodyRequest(
    id: string,
    dto: {
      operationId: string;
      expectedRequestVersion: number;
      resolutionNote: string;
    },
  ): Promise<CustodyRequest> {
    const response = await apiClient.post<ApiResponse<CustodyRequest>>(
      `/asset-custody-requests/${id}/reject`,
      dto,
    );
    return unwrapApiData(response.data);
  }

  static async allocateLicense(
    assetId: string,
    dto: {
      operationId: string;
      employeeId: string;
      allocatedDate: string;
      expectedPoolVersion?: number;
      remarks?: string;
    },
  ) {
    const response = await apiClient.post(
      `/asset/${assetId}/license-allocations`,
      {
        ...dto,
        operationId: dto.operationId || createOperationId(),
      },
    );
    return unwrapApiData(response.data);
  }

  static async getHistory(id: string) {
    const response = await apiClient.get(`/asset/${id}/history`);
    return unwrapApiData(response.data);
  }

  static async requestTransfer(
    assetId: string,
    dto: {
      operationId: string;
      toDepartmentId: string;
      reason: string;
      expectedAssetVersion?: number;
    },
  ) {
    const response = await apiClient.post(`/asset/${assetId}/transfers`, {
      ...dto,
      operationId: dto.operationId || createOperationId(),
    });
    return unwrapApiData(response.data);
  }

  static async getTransfers(query: { page?: number; limit?: number } = {}) {
    const response = await apiClient.get("/asset-transfers", { params: query });
    return unwrapPage(unwrapApiData(response.data));
  }

  static async decideTransfer(
    id: string,
    action: "accept" | "reject" | "cancel" | "force",
    dto: Record<string, unknown>,
  ) {
    const response = await apiClient.post(`/asset-transfers/${id}/${action}`, {
      ...dto,
      operationId: dto.operationId || createOperationId(),
    });
    return unwrapApiData(response.data);
  }

  static async lifecycle(
    id: string,
    action:
      | "send-to-repair"
      | "complete-repair"
      | "mark-lost"
      | "dispose"
      | "suspend"
      | "resume"
      | "retire",
    dto: Record<string, unknown>,
  ) {
    const response = await apiClient.post(`/asset/${id}/${action}`, {
      ...dto,
      operationId: dto.operationId || createOperationId(),
    });
    return mapAsset(unwrapApiData(response.data) as Asset);
  }

  static async getLicenseAllocations(assetId: string) {
    const response = await apiClient.get(`/asset/${assetId}/license-allocations`);
    return unwrapPage(unwrapApiData(response.data));
  }

  static async getDepartmentGrants(query: { includeInactive?: boolean } = {}) {
    const response = await apiClient.get("/asset-department-grants", {
      params: { limit: 50, ...query },
    });
    return unwrapPage(unwrapApiData(response.data));
  }

  static async getEligibleGrantUsers(query: { departmentId?: string } = {}) {
    const response = await apiClient.get(
      "/asset-department-grants/eligible-users",
      { params: query },
    );
    return unwrapApiData<{
      items: Array<{
        id: string;
        displayName: string;
        email: string | null;
        employeeCode: string | null;
      }>;
    }>(response.data);
  }

  static async createDepartmentGrant(dto: {
    operationId: string;
    departmentId: string;
    userId: string;
    reason?: string;
  }) {
    const response = await apiClient.post("/asset-department-grants", {
      ...dto,
      operationId: dto.operationId || createOperationId(),
    });
    return unwrapApiData(response.data);
  }

  static async decideDepartmentGrant(
    id: string,
    action: "revoke" | "reactivate" | "regrant",
    dto: { operationId: string; expectedVersion?: number; reason?: string },
  ) {
    const response = await apiClient.post(`/asset-department-grants/${id}/${action}`, {
      ...dto,
      operationId: dto.operationId || createOperationId(),
    });
    return unwrapApiData(response.data);
  }

  static async getWaivers(query: { page?: number; limit?: number } = {}) {
    const response = await apiClient.get("/asset-clearance-waivers", {
      params: query,
    });
    return unwrapPage(unwrapApiData(response.data));
  }

  static async decideWaiver(
    id: string,
    action: "approve" | "reject" | "cancel",
    dto: Record<string, unknown>,
  ) {
    const response = await apiClient.post(
      `/asset-clearance-waivers/${id}/${action}`,
      {
        ...dto,
        operationId: dto.operationId || createOperationId(),
      },
    );
    return unwrapApiData(response.data);
  }

  static async getLicenseAllocationPage(
    query: { page?: number; limit?: number; assetId?: string } = {},
  ) {
    const response = await apiClient.get("/asset-license-allocations", {
      params: { limit: 50, ...query },
    });
    return unwrapPage(unwrapApiData(response.data));
  }

  static async revokeLicense(
    id: string,
    dto: {
      operationId: string;
      expectedAllocationVersion: number;
      expectedPoolVersion?: number;
      revokedDate: string;
      reason: string;
    },
  ) {
    const response = await apiClient.patch(
      `/asset-license-allocations/${id}/revoke`,
      {
        ...dto,
        operationId: dto.operationId || createOperationId(),
      },
    );
    return unwrapApiData(response.data);
  }

  static async resizeLicensePool(
    assetId: string,
    dto: {
      operationId: string;
      expectedVersion: number;
      seatCapacity: number;
      reason: string;
    },
  ) {
    const response = await apiClient.post(`/asset/${assetId}/license-capacity`, {
      ...dto,
      operationId: dto.operationId || createOperationId(),
    });
    return mapAsset(unwrapApiData(response.data) as Asset);
  }

  static async getEligibleEmployees(
    assetId: string,
    query: { page?: number; limit?: number } = {},
  ) {
    const response = await apiClient.get<
      ApiResponse<{
        items: Array<{ id: string; code: string; name: string }>;
        total: number;
        page: number;
        limit: number;
      }>
    >("/asset/eligible-employees", {
      params: { assetId, page: 1, limit: 100, ...query },
    });
    return unwrapApiData(response.data);
  }

  static async getEligibleForAssignment(
    employeeId: string,
    query: { page?: number; limit?: number } = {},
  ) {
    const response = await apiClient.get<ApiResponse<PaginatedAssets>>(
      "/asset/eligible-for-assignment",
      {
        params: { employeeId, page: 1, limit: 100, ...query },
      },
    );
    const page = unwrapPage(unwrapApiData(response.data));
    return {
      ...page,
      items: page.items.map(mapAsset),
    };
  }
}
