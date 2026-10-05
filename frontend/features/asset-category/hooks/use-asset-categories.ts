"use client";

import { useQuery } from "@tanstack/react-query";

import { AssetCategoryService } from "../services/asset-category-service";
import type { AssetCategoryListQuery } from "../types/asset-category";

export function useAssetCategories(query: AssetCategoryListQuery = {}) {
  return useQuery({
    queryKey: ["asset-categories", query],
    queryFn: () => AssetCategoryService.getAll(query),
  });
}
