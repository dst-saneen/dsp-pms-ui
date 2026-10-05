"use client";

import { useQuery } from "@tanstack/react-query";

import { CompanyGroupService } from "../services/company-group-service";

export function useCompanyGroups() {
  return useQuery({
    queryKey: ["company-groups"],
    queryFn: () =>
      CompanyGroupService.getAll(),
  });
}