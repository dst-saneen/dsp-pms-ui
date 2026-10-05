import { useQuery } from "@tanstack/react-query";

import { AssetService } from "../services/asset-service";

export function useEligibleEmployees(assetId?: string) {
  return useQuery({
    queryKey: ["assets", "eligible-employees", assetId],
    queryFn: () =>
      AssetService.getEligibleEmployees(assetId!, { limit: 100, page: 1 }),
    enabled: Boolean(assetId),
  });
}

export function useEligibleForAssignment(employeeId?: string) {
  return useQuery({
    queryKey: ["assets", "eligible-for-assignment", employeeId],
    queryFn: () =>
      AssetService.getEligibleForAssignment(employeeId!, {
        limit: 100,
        page: 1,
      }),
    enabled: Boolean(employeeId),
  });
}
