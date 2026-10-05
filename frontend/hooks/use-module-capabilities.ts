"use client";

import { useQuery } from "@tanstack/react-query";

import { API_ENDPOINTS } from "@/config/api";
import { useAuth } from "@/providers/auth-provider";
import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api";

export type FinanceCollectionAction =
  "CREATE_TRANSACTION" | "MANAGE_SETUP" | "CREATE_PERIOD" | "EXPORT_REPORT";

export type PayrollCollectionAction =
  | "CREATE_RUN"
  | "MANAGE_COMPONENTS"
  | "MANAGE_EMPLOYEE_INPUTS"
  | "EXPORT_REGISTER";

export interface ModuleCapabilities {
  projects: boolean;
  finance: boolean;
  payroll: boolean;
  financeNav?: boolean;
  payrollNav?: boolean;
  projectsNav?: boolean;
  onboardingNav?: boolean;
  assetsNav?: boolean;
  /** My Workspace assets card for employees (self-service). */
  assetSelfNav?: boolean;
  deliveryOperationsNav?: boolean;
  fileOperationsNav?: boolean;
  recruitmentNav?: boolean;
  recruitmentShortlist?: boolean;
  financeActions?: FinanceCollectionAction[];
  payrollActions?: PayrollCollectionAction[];
  payrollDependencyState?: {
    ready: boolean;
    blockedReasons: string[];
  };
}

export const moduleCapabilitiesKeys = {
  all: ["module-capabilities"] as const,
};

async function fetchModuleCapabilities(): Promise<ModuleCapabilities> {
  const response = await apiClient.get<ApiResponse<ModuleCapabilities>>(
    API_ENDPOINTS.me.moduleCapabilities,
  );
  return unwrapApiData(response.data);
}

export function useModuleCapabilities() {
  const { status } = useAuth();

  return useQuery({
    queryKey: moduleCapabilitiesKeys.all,
    queryFn: fetchModuleCapabilities,
    enabled: status === "authenticated",
    staleTime: 5 * 60 * 1000,
  });
}
