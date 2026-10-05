import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api";
import { unwrapPage } from "@/features/asset/lib/kind-tracking";
import { createOperationId } from "@/features/asset/lib/operation-id";
import type { ArchiveTaxonomyDto } from "@/features/asset-type/types/asset-type";

import type {
  AssetCategory,
  AssetCategoryListQuery,
  CreateAssetCategoryDto,
  PaginatedAssetCategories,
  UpdateAssetCategoryDto,
} from "../types/asset-category";

type RawAssetCategory = AssetCategory & {
  company?: { id: string; name?: string; companyName?: string };
  archived?: boolean;
};

function mapCategory(raw: RawAssetCategory): AssetCategory {
  const archived = Boolean(raw.archived) || raw.isActive === false;

  return {
    ...raw,
    companyId: raw.companyId || raw.company?.id || "",
    version: raw.version ?? 1,
    archived,
    isActive: !archived,
    allowedActions: raw.allowedActions ?? [],
    company: raw.company
      ? {
          id: raw.company.id,
          name: raw.company.name,
          companyName: raw.company.companyName ?? raw.company.name,
        }
      : undefined,
  };
}

export class AssetCategoryService {
  static async getAll(
    query: AssetCategoryListQuery = {},
  ): Promise<PaginatedAssetCategories> {
    const response = await apiClient.get<
      ApiResponse<PaginatedAssetCategories | RawAssetCategory[]>
    >("/asset-categories", {
      params: {
        limit: 100,
        includeInactive: true,
        ...query,
      },
    });
    const page = unwrapPage(unwrapApiData(response.data));
    return {
      ...page,
      items: page.items.map(mapCategory),
    };
  }

  static async getById(id: string): Promise<AssetCategory> {
    const response = await apiClient.get<ApiResponse<RawAssetCategory>>(
      `/asset-categories/${id}`,
    );
    return mapCategory(unwrapApiData(response.data));
  }

  static async create(dto: CreateAssetCategoryDto): Promise<AssetCategory> {
    const response = await apiClient.post<ApiResponse<RawAssetCategory>>(
      "/asset-categories",
      {
        ...dto,
        operationId: dto.operationId || createOperationId(),
      },
    );
    return mapCategory(unwrapApiData(response.data));
  }

  static async update(
    id: string,
    dto: UpdateAssetCategoryDto,
  ): Promise<AssetCategory> {
    const response = await apiClient.patch<ApiResponse<RawAssetCategory>>(
      `/asset-categories/${id}`,
      {
        ...dto,
        operationId: dto.operationId || createOperationId(),
      },
    );
    return mapCategory(unwrapApiData(response.data));
  }

  static async archive(
    id: string,
    dto: ArchiveTaxonomyDto,
  ): Promise<AssetCategory> {
    const response = await apiClient.post<ApiResponse<RawAssetCategory>>(
      `/asset-categories/${id}/archive`,
      {
        ...dto,
        operationId: dto.operationId || createOperationId(),
      },
    );
    return mapCategory(unwrapApiData(response.data));
  }

  static async delete(id: string): Promise<AssetCategory> {
    return this.archive(id, {
      operationId: createOperationId(),
      expectedVersion: 1,
      reason: "Compatibility archive",
    });
  }
}
