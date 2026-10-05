"use client";

import { useQuery } from "@tanstack/react-query";

import { CompanyGroupService } from "../services/company-group-service";

export function useCompanyGroup(id: string) {
  return useQuery({
    queryKey: ["company-groups", id],
    queryFn: () =>
      CompanyGroupService.getById(id),
    enabled: !!id,
  });
}