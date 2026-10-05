"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { moduleCapabilitiesKeys } from "@/hooks/use-module-capabilities";

import { CompanyService } from "../services/company-service";
import type { UpdateCompanyModuleEntitlementsDto } from "../types/company";

export const companyModuleEntitlementKeys = {
  all: ["company-module-entitlements"] as const,
  detail: (companyId: string) =>
    [...companyModuleEntitlementKeys.all, companyId] as const,
};

export function useCompanyModuleEntitlements(companyId: string) {
  return useQuery({
    queryKey: companyModuleEntitlementKeys.detail(companyId),
    queryFn: () => CompanyService.getModuleEntitlements(companyId),
    enabled: Boolean(companyId),
  });
}

export function useUpdateCompanyModuleEntitlements(companyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: UpdateCompanyModuleEntitlementsDto) =>
      CompanyService.updateModuleEntitlements(companyId, dto),
    onSuccess: (data) => {
      queryClient.setQueryData(
        companyModuleEntitlementKeys.detail(companyId),
        data,
      );
      void queryClient.invalidateQueries({
        queryKey: moduleCapabilitiesKeys.all,
      });
    },
  });
}
