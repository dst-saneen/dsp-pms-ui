import type { AssetKind, AssetTrackingMode } from "@/features/asset/lib/kind-tracking";

export type TaxonomyAllowedAction = "EDIT" | "ARCHIVE" | "REACTIVATE";

export interface NamedRef {
  id: string;
  name?: string;
  companyName?: string;
}

export interface AssetCategoryLookup {
  id: string;
  companyId?: string;
  assetCategoryCode?: string;
  assetCategoryName?: string;
}

export interface AssetType {
  id: string;
  companyId: string;
  assetCategoryId: string;
  assetTypeCode: string;
  assetTypeName: string;
  description?: string;
  kind: AssetKind;
  trackingMode: AssetTrackingMode;
  version: number;
  archived: boolean;
  isActive: boolean;
  assetCount?: number;
  classificationMutable?: boolean;
  allowedActions: TaxonomyAllowedAction[];
  company?: NamedRef & { companyName?: string; companyCode?: string };
  assetCategory?: AssetCategoryLookup;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssetTypeDto {
  operationId: string;
  companyId: string;
  assetCategoryId: string;
  assetTypeName: string;
  description?: string;
  kind: AssetKind;
  trackingMode: AssetTrackingMode;
}

export interface UpdateAssetTypeDto {
  operationId: string;
  expectedVersion: number;
  assetCategoryId?: string;
  assetTypeName?: string;
  description?: string | null;
  kind?: AssetKind;
  trackingMode?: AssetTrackingMode;
}

export interface ArchiveTaxonomyDto {
  operationId: string;
  expectedVersion: number;
  reason: string;
}

export interface AssetTypeListQuery {
  page?: number;
  limit?: number;
  keyword?: string;
  includeInactive?: boolean;
  companyId?: string;
  assetCategoryId?: string;
  kind?: AssetKind;
}

export interface PaginatedAssetTypes {
  items: AssetType[];
  total: number;
  page: number;
  limit: number;
}
