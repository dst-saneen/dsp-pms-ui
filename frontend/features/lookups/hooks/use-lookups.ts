"use client";

import { useQuery } from "@tanstack/react-query";

import { LookupService } from "../services/lookup-service";

export function useCompanies() {
  return useQuery({
    queryKey: ["lookups", "companies"],
    queryFn: LookupService.getCompanies,
    staleTime: 1000 * 60 * 30,
  });
}

export function useBranches(companyId?: string) {
  return useQuery({
    queryKey: ["lookups", "branches", companyId],
    queryFn: () => LookupService.getBranches(companyId),
    enabled: !!companyId,
  });
}

interface DepartmentLookupOptions {
  enabled?: boolean;
  companyId?: string;
}

export function useDepartments(
  branchId?: string,
  options: DepartmentLookupOptions = {},
) {
  return useQuery({
    queryKey: ["lookups", "departments", branchId, options.companyId],
    queryFn: () => LookupService.getDepartments(branchId, options.companyId),
    enabled: options.enabled ?? true,
  });
}

export function useDesignations(companyId?: string) {
  return useQuery({
    queryKey: ["lookups", "designations", companyId],
    queryFn: () => LookupService.getDesignations(companyId),
    enabled: !!companyId,
  });
}

export function useManagers(companyId?: string) {
  return useQuery({
    queryKey: ["lookups", "managers", companyId],
    queryFn: () => LookupService.getManagers(companyId),
    enabled: !!companyId,
  });
}
