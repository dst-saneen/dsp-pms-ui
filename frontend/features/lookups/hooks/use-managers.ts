"use client";

import { useQuery } from "@tanstack/react-query";

import { LookupService } from "../services/lookup-service";

export function useManagers(companyId?: string) {
  return useQuery({
    queryKey: ["lookups", "managers", companyId],
    queryFn: () => LookupService.getManagers(companyId),
    enabled: !!companyId,
  });
}
