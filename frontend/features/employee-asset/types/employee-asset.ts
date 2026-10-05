import type { AssetKind, AssetTrackingMode } from "@/features/asset/lib/kind-tracking";

export type AssetReturnOutcome = "RETURNED" | "LOST" | "DAMAGED";

export type EmployeeAssetAllowedAction =
  | "RETURN"
  | "CLOSE_DAMAGED"
  | "CLOSE_LOST"
  | "ACKNOWLEDGE"
  | "REQUEST_RETURN"
  | "REPORT_DAMAGED"
  | "REPORT_LOST";

export type LicenseAllocationAllowedAction =
  | "REVOKE"
  | "ACKNOWLEDGE"
  | "REQUEST_LICENSE_REVOKE";

export interface AssetSummaryRef {
  id: string;
  assetCode: string;
  assetName: string;
  version: number;
  kind?: AssetKind;
  trackingMode?: AssetTrackingMode;
  lifecycleStatus?: string;
  department?: { id: string; name?: string };
  assetType?: { id: string; name?: string };
}

export interface EmployeeRef {
  id: string;
  code?: string;
  name?: string;
  employeeCode?: string;
  firstName?: string;
  lastName?: string | null;
}

export interface EmployeeAsset {
  id: string;
  version: number;
  custodyStatus: string;
  status?: string;
  employeeId?: string;
  assetId?: string;
  employee?: EmployeeRef;
  asset?: AssetSummaryRef;
  assignedDate: string;
  acknowledgedAt?: string | null;
  allowedActions: EmployeeAssetAllowedAction[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeAsset {
  operationId: string;
  employeeId: string;
  assetId: string;
  assignedDate: string;
  expectedAssetVersion?: number;
  remarks?: string;
}

export interface ReturnEmployeeAsset {
  operationId: string;
  outcome: AssetReturnOutcome;
  returnedDate?: string;
  effectiveDate?: string;
  expectedAssignmentVersion?: number;
  expectedAssetVersion?: number;
  reason?: string;
  remarks?: string;
}

export interface LicenseAllocation {
  id: string;
  version: number;
  status: string;
  employee?: EmployeeRef;
  pool?: AssetSummaryRef;
  allocatedAt: string;
  acknowledgedAt?: string | null;
  allowedActions: LicenseAllocationAllowedAction[];
}

export interface AllocateLicenseDto {
  operationId: string;
  employeeId: string;
  allocatedDate: string;
  expectedPoolVersion?: number;
  remarks?: string;
}

export interface RevokeLicenseDto {
  operationId: string;
  expectedAllocationVersion: number;
  expectedPoolVersion?: number;
  revokedDate: string;
  reason: string;
}

export interface PaginatedEmployeeAssets {
  items: EmployeeAsset[];
  total: number;
  page: number;
  limit: number;
}

export interface AssetClearancePreflight {
  employeeId: string;
  blocked: boolean;
  openAssignments: Array<{
    id: string;
    version: number;
    assetId: string;
    asset?: { id: string; assetCode: string; assetName: string; version: number };
  }>;
  openAllocations: Array<{
    id: string;
    version: number;
    assetId: string;
    asset?: { id: string; assetCode: string; assetName: string; version: number };
  }>;
}
