"use client";

import { useQuery } from "@tanstack/react-query";

import { AssetTypeService } from "../services/asset-type-service";
import type { AssetTypeListQuery } from "../types/asset-type";

export function useAssetTypes(query: AssetTypeListQuery = {}) {
  return useQuery({
    queryKey: ["asset-types", query],
    queryFn: () => AssetTypeService.getAll(query),
  });
}
