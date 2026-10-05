import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api";
import { unwrapPage } from "@/features/asset/lib/kind-tracking";
import { createOperationId } from "@/features/asset/lib/operation-id";
import type { AssetKind } from "@/features/asset/lib/kind-tracking";

import type {
  ArchiveTaxonomyDto,
  AssetType,
  AssetTypeListQuery,
  CreateAssetTypeDto,
  PaginatedAssetTypes,
  UpdateAssetTypeDto,
} from "../types/asset-type";

type RawAssetType = AssetType & {
  company?: { id: string; name?: string; companyName?: string };
  category?: { id: string; name?: string };
  archived?: boolean;
};

function mapAssetType(raw: RawAssetType): AssetType {
  const companyId = raw.companyId || raw.company?.id || "";
  const categoryId = raw.assetCategoryId || raw.category?.id || raw.assetCategory?.id || "";
  const archived = Boolean(raw.archived) || raw.isActive === false;

  return {
    ...raw,
    companyId,
    assetCategoryId: categoryId,
    kind: (raw.kind ?? "GENERAL") as AssetKind,
    trackingMode: raw.trackingMode ?? "INDIVIDUAL",
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
    assetCategory: raw.assetCategory ??
      (raw.category
        ? {
            id: raw.category.id,
            assetCategoryName: raw.category.name,
          }
        : undefined),
  };
}

export class AssetTypeService {
  static async getAll(query: AssetTypeListQuery = {}): Promise<PaginatedAssetTypes> {
    const response = await apiClient.get<ApiResponse<PaginatedAssetTypes | RawAssetType[]>>(
      "/asset-types",
      {
        params: {
          limit: 100,
          includeInactive: true,
          ...query,
        },
      },
    );
    const page = unwrapPage(unwrapApiData(response.data));
    return {
      ...page,
      items: page.items.map(mapAssetType),
    };
  }

  static async getById(id: string): Promise<AssetType> {
    const response = await apiClient.get<ApiResponse<RawAssetType>>(
      `/asset-types/${id}`,
    );
    return mapAssetType(unwrapApiData(response.data));
  }

  static async create(dto: CreateAssetTypeDto): Promise<AssetType> {
    const response = await apiClient.post<ApiResponse<RawAssetType>>(
      "/asset-types",
      {
        ...dto,
        operationId: dto.operationId || createOperationId(),
      },
    );
    return mapAssetType(unwrapApiData(response.data));
  }

  static async update(id: string, dto: UpdateAssetTypeDto): Promise<AssetType> {
    const response = await apiClient.patch<ApiResponse<RawAssetType>>(
      `/asset-types/${id}`,
      {
        ...dto,
        operationId: dto.operationId || createOperationId(),
      },
    );
    return mapAssetType(unwrapApiData(response.data));
  }

  static async archive(id: string, dto: ArchiveTaxonomyDto): Promise<AssetType> {
    const response = await apiClient.post<ApiResponse<RawAssetType>>(
      `/asset-types/${id}/archive`,
      {
        ...dto,
        operationId: dto.operationId || createOperationId(),
      },
    );
    return mapAssetType(unwrapApiData(response.data));
  }

  static async delete(id: string): Promise<AssetType> {
    return this.archive(id, {
      operationId: createOperationId(),
      expectedVersion: 1,
      reason: "Compatibility archive",
    });
  }
}
