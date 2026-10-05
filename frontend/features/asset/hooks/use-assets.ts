"use client";

import { useQuery } from "@tanstack/react-query";

import {
  AssetService,
} from "../services/asset-service";
import type { AssetListQuery } from "../types/asset";

export function useAssets(query: AssetListQuery = {}) {
  return useQuery({
    queryKey: ["assets", query],
    queryFn: () =>
      AssetService.getAll({
        limit: 100,
        includeInactive: true,
        ...query,
      }),
  });
}
