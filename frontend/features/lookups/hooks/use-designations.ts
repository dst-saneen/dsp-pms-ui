"use client";

import { useQuery } from "@tanstack/react-query";

import { LookupService } from "../services/lookup-service";

export function useDesignations(companyId?: string) {
  return useQuery({
    queryKey: ["lookups", "designations", companyId],
    queryFn: () => LookupService.getDesignations(companyId),
    enabled: !!companyId,
  });
}
