"use client";

import { useQuery } from "@tanstack/react-query";

import { LookupService } from "../services";

export function useCompanyGroups() {
  return useQuery({
    queryKey: ["lookups", "company-groups"],
    queryFn: LookupService.getCompanyGroups,
    staleTime: 1000 * 60 * 30,
  });
}
