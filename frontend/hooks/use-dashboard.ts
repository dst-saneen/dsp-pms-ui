"use client";

import { useQuery } from "@tanstack/react-query";

import { DashboardService } from "@/services/dashboard.service";

export function usePayrollSummary() {
  return useQuery({
    queryKey: ["payroll-summary"],
    queryFn: DashboardService.getPayrollSummary,
  });
}