"use client";

import { useQuery } from "@tanstack/react-query";

import { LookupService } from "../services";

export function useCompanies() {
  return useQuery({
    queryKey: ["lookups", "companies"],
    queryFn: LookupService.getCompanies,
    staleTime: 1000 * 60 * 30,
  });
}
