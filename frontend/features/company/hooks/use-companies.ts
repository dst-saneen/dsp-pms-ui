"use client";

import { useQuery } from "@tanstack/react-query";

import { CompanyService } from "../services/company-service";

export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: () => CompanyService.getAll(),
  });
}