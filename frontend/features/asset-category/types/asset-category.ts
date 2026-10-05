import type { TaxonomyAllowedAction } from "@/features/asset-type/types/asset-type";

export interface AssetCategory {
  id: string;
  companyId: string;
  assetCategoryCode: string;
  assetCategoryName: string;
  description?: string;
  version: number;
  archived: boolean;
  isActive: boolean;
  assetTypeCount?: number;
  allowedActions: TaxonomyAllowedAction[];
  company?: {
    id: string;
    companyCode?: string;
    companyName?: string;
    name?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssetCategoryDto {
  operationId: string;
  companyId: string;
  assetCategoryName: string;
  description?: string;
}

export interface UpdateAssetCategoryDto {
  operationId: string;
  expectedVersion: number;
  assetCategoryName?: string;
  description?: string | null;
}

export interface AssetCategoryListQuery {
  page?: number;
  limit?: number;
  keyword?: string;
  includeInactive?: boolean;
  companyId?: string;
}

export interface PaginatedAssetCategories {
  items: AssetCategory[];
  total: number;
  page: number;
  limit: number;
}
