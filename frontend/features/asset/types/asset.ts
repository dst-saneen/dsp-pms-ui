import type { AssetCatalog, AssetKind, AssetTrackingMode } from "../lib/kind-tracking";

export type AssetInventoryAction =
  | "READ"
  | "UPDATE_METADATA"
  | "ASSIGN"
  | "ARCHIVE"
  | "TRANSFER";

export type AssetLifecycleStatus =
  | "IN_SERVICE"
  | "IN_REPAIR"
  | "SUSPENDED"
  | "LOST"
  | "RETIRED"
  | "DISPOSED";

export interface NamedRef {
  id: string;
  name?: string;
  companyName?: string;
  branchName?: string;
  departmentName?: string;
  companyCode?: string;
  branchCode?: string;
  departmentCode?: string;
}

export interface AssetCategoryLookup {
  id: string;
  assetCategoryCode?: string;
  assetCategoryName?: string;
}

export interface AssetTypeLookup {
  id: string;
  assetTypeCode?: string;
  assetTypeName?: string;
  assetCategoryId?: string;
  kind?: AssetKind;
  trackingMode?: AssetTrackingMode;
  assetCategory?: AssetCategoryLookup;
}

export interface Asset {
  id: string;
  companyId: string;
  branchId?: string | null;
  departmentId?: string | null;
  assetTypeId: string;
  assetCode: string;
  assetName: string;
  kind: AssetKind;
  trackingMode: AssetTrackingMode;
  lifecycleStatus: AssetLifecycleStatus | string;
  status: string;
  isActive: boolean;
  version: number;
  serialNumber?: string | null;
  manufacturer?: string | null;
  modelNumber?: string | null;
  purchaseDate?: string | null;
  purchaseCost?: string | number | null;
  currency?: string | null;
  warrantyExpiry?: string | null;
  location?: string | null;
  remarks?: string | null;
  allowedActions: AssetInventoryAction[];
  softwareLicenseDetail?: {
    seatCapacity?: number;
    vendorName?: string;
    productName?: string;
  } | null;
  company?: NamedRef;
  branch?: NamedRef | null;
  department?: NamedRef | null;
  assetType?: AssetTypeLookup;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssetCardPayload {
  cardNumber: string;
  issuer?: string;
  accessZone?: string;
  issuedDate: string;
  expiryDate?: string;
}

export interface CreateAssetLicensePayload {
  vendorName: string;
  productName: string;
  contractReference?: string;
  vaultReference?: string;
  startsOn?: string;
  expiresOn?: string;
  renewsOn?: string;
  seatCapacity: number;
}

export interface CreateAssetDto {
  operationId: string;
  companyId: string;
  departmentId: string;
  assetTypeId: string;
  assetName: string;
  serialNumber?: string;
  manufacturer?: string;
  modelNumber?: string;
  purchaseDate?: string;
  purchaseCost?: string;
  currency?: string;
  warrantyExpiry?: string;
  location?: string;
  remarks?: string;
  card?: CreateAssetCardPayload;
  softwareLicense?: CreateAssetLicensePayload;
}

export interface UpdateAssetDto {
  operationId: string;
  expectedVersion: number;
  assetName?: string;
  manufacturer?: string;
  modelNumber?: string;
  purchaseDate?: string | null;
  purchaseCost?: string | null;
  currency?: string | null;
  warrantyExpiry?: string | null;
  location?: string | null;
  remarks?: string | null;
  cardMetadata?: {
    issuer?: string | null;
    accessZone?: string | null;
    expiryDate?: string | null;
  };
  licenseMetadata?: {
    vendorName?: string;
    productName?: string;
    contractReference?: string | null;
    vaultReference?: string | null;
    startsOn?: string | null;
    expiresOn?: string | null;
    renewsOn?: string | null;
  };
}

export interface ArchiveAssetDto {
  operationId: string;
  expectedVersion: number;
  reason: string;
}

export interface PaginatedAssets {
  items: Asset[];
  total: number;
  page: number;
  limit: number;
}

export interface AssetInventorySummary {
  total: number;
  active: number;
  inactive: number;
  assigned: number;
}

export interface AssetListQuery {
  page?: number;
  limit?: number;
  keyword?: string;
  includeInactive?: boolean;
  companyId?: string;
  departmentId?: string;
  branchId?: string;
  assetCategoryId?: string;
  assetTypeId?: string;
  kind?: AssetKind;
  catalog?: AssetCatalog;
  trackingMode?: AssetTrackingMode;
  lifecycleStatus?: string;
  availabilityStatus?: string;
  expiringBefore?: string;
}

export interface AssetDepartmentOption {
  id: string;
  name: string;
  code?: string;
  branch?: { id: string; name: string };
  company?: { id: string; name: string };
}

export interface CustodyRequest {
  id: string;
  version: number;
  status: string;
  requestType: string;
  targetType: string;
  employeeAssetId?: string;
  licenseAllocationId?: string;
  targetVersion?: number;
  assetVersion?: number;
  asset?: {
    id: string;
    assetCode: string;
    assetName: string;
  };
  employee?: { id: string; code: string; name: string };
  requestedAt: string;
  employeeNote?: string;
  allowedActions?: string[];
}

export interface PaginatedCustodyRequests {
  items: CustodyRequest[];
  total: number;
  page: number;
  limit: number;
}
