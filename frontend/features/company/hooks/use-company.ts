"use client";

import { useQuery } from "@tanstack/react-query";

import { CompanyService } from "../services/company-service";

export function useCompany(id?: string) {
  return useQuery({
    queryKey: ["companies", "detail", id],
    queryFn: () => CompanyService.getById(id!),
    enabled: Boolean(id),
  });
}
