import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api";
import { unwrapPage } from "@/features/asset/lib/kind-tracking";
import { createOperationId } from "@/features/asset/lib/operation-id";

import type {
  AllocateLicenseDto,
  AssetClearancePreflight,
  CreateEmployeeAsset,
  EmployeeAsset,
  PaginatedEmployeeAssets,
  ReturnEmployeeAsset,
  RevokeLicenseDto,
} from "../types";

function mapAssignment(raw: EmployeeAsset): EmployeeAsset {
  return {
    ...raw,
    version: raw.version ?? 1,
    custodyStatus: raw.custodyStatus || raw.status || "ASSIGNED",
    status: raw.status || raw.custodyStatus,
    employeeId: raw.employeeId || raw.employee?.id,
    assetId: raw.assetId || raw.asset?.id,
    allowedActions: raw.allowedActions ?? [],
  };
}

export class EmployeeAssetService {
  static async getAll(): Promise<EmployeeAsset[]> {
    const response = await apiClient.get<
      ApiResponse<PaginatedEmployeeAssets | EmployeeAsset[]>
    >("/employee-assets", { params: { limit: 100 } });
    return unwrapPage(unwrapApiData(response.data)).items.map(mapAssignment);
  }

  static async getByEmployee(employeeId: string): Promise<EmployeeAsset[]> {
    const response = await apiClient.get<ApiResponse<EmployeeAsset[]>>(
      `/employee-assets/employee/${employeeId}`,
    );
    const data = unwrapApiData(response.data);
    return (Array.isArray(data) ? data : []).map(mapAssignment);
  }

  static async create(dto: CreateEmployeeAsset): Promise<EmployeeAsset> {
    const response = await apiClient.post<ApiResponse<EmployeeAsset>>(
      "/employee-assets",
      {
        ...dto,
        operationId: dto.operationId || createOperationId(),
      },
    );
    return mapAssignment(unwrapApiData(response.data));
  }

  static async returnAsset(
    id: string,
    dto: ReturnEmployeeAsset,
  ): Promise<EmployeeAsset> {
    const response = await apiClient.patch<ApiResponse<EmployeeAsset>>(
      `/employee-assets/${id}/return`,
      {
        ...dto,
        operationId: dto.operationId || createOperationId(),
      },
    );
    return mapAssignment(unwrapApiData(response.data));
  }

  static async allocateLicense(assetId: string, dto: AllocateLicenseDto) {
    const response = await apiClient.post(
      `/asset/${assetId}/license-allocations`,
      {
        ...dto,
        operationId: dto.operationId || createOperationId(),
      },
    );
    return unwrapApiData(response.data);
  }

  static async revokeLicense(id: string, dto: RevokeLicenseDto) {
    const response = await apiClient.patch(
      `/asset-license-allocations/${id}/revoke`,
      {
        ...dto,
        operationId: dto.operationId || createOperationId(),
      },
    );
    return unwrapApiData(response.data);
  }

  static async getClearancePreflight(
    employeeId: string,
  ): Promise<AssetClearancePreflight> {
    const response = await apiClient.get<ApiResponse<AssetClearancePreflight>>(
      `/employees/${employeeId}/asset-clearance-preflight`,
    );
    return unwrapApiData(response.data);
  }
}
