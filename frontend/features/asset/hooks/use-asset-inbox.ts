"use client";

import { useQuery } from "@tanstack/react-query";

import { AssetService } from "../services/asset-service";

export function useAssetSummary() {
  return useQuery({
    queryKey: ["assets", "summary"],
    queryFn: () => AssetService.summarize(),
  });
}

export function useAssetDepartments() {
  return useQuery({
    queryKey: ["assets", "departments"],
    queryFn: () => AssetService.getGrantedDepartments(),
  });
}

export function useAssetCustodyInbox() {
  return useQuery({
    queryKey: ["assets", "custody-requests", "inbox"],
    queryFn: () =>
      AssetService.getCustodyRequests({
        limit: 20,
        status: "SUBMITTED",
      }),
  });
}

export function useExpiringAssets() {
  return useQuery({
    queryKey: ["assets", "expiring"],
    queryFn: () => {
      const expiringBefore = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      return AssetService.getAll({
        limit: 20,
        expiringBefore,
        includeInactive: false,
      });
    },
  });
}
