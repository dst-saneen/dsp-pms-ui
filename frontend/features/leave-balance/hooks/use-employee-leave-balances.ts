"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/services/api-client";

import { LeaveBalanceService } from "../services/leave-balance-service";
import type {
  GenerateLeaveBalancesInput,
  LeaveBalanceListFilters,
} from "../types/leave-balance";

export const leaveBalanceKeys = {
  all: ["employee-leave-balances"] as const,
  list: (filters: LeaveBalanceListFilters) =>
    [...leaveBalanceKeys.all, "list", filters] as const,
};

export function useEmployeeLeaveBalances(filters: LeaveBalanceListFilters) {
  return useQuery({
    queryKey: leaveBalanceKeys.list(filters),
    queryFn: () => LeaveBalanceService.getAll(filters),
    enabled: Boolean(filters.year),
  });
}

export function useGenerateLeaveBalances() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateLeaveBalancesInput) =>
      LeaveBalanceService.generate(input),
    onSuccess: (result) => {
      if (!result.dryRun) {
        void queryClient.invalidateQueries({ queryKey: leaveBalanceKeys.all });
      }
      toast.success(
        result.dryRun
          ? `Preview: ${result.balancesToCreate} new balance(s) would be added, ${result.existingBalancesToRetain} already exist.`
          : `Created ${result.createdCount} leave balance(s).`,
      );
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Unable to generate leave balances."),
      );
    },
  });
}
