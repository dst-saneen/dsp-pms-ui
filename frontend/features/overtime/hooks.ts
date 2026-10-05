"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/services/api-client";

import { OvertimeService } from "./service";
import type { ApproveOvertimeDto, OvertimeRequestFilters } from "./types";

export const overtimeKeys = { all: ["overtime-requests"] as const };

export function useOvertimeRequests(filters?: OvertimeRequestFilters) {
  return useQuery({
    queryKey: [...overtimeKeys.all, filters ?? {}],
    queryFn: () => OvertimeService.getAll(filters),
  });
}

function useOvertimeMutation<T>(
  mutationFn: (input: T) => Promise<unknown>,
  successMessage: string,
  errorMessage: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: overtimeKeys.all });
      toast.success(successMessage);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, errorMessage)),
  });
}

export function useApproveOvertime() {
  return useOvertimeMutation(
    ({ id, data }: { id: string; data: ApproveOvertimeDto }) =>
      OvertimeService.approve(id, data),
    "Overtime request approved.",
    "Unable to approve overtime request.",
  );
}

export function useRejectOvertime() {
  return useOvertimeMutation(
    ({ id, remarks }: { id: string; remarks: string }) =>
      OvertimeService.reject(id, remarks),
    "Overtime request rejected.",
    "Unable to reject overtime request.",
  );
}

export function useCancelOvertime() {
  return useOvertimeMutation(
    ({ id, reason }: { id: string; reason?: string }) =>
      OvertimeService.cancel(id, reason),
    "Overtime request cancelled.",
    "Unable to cancel overtime request.",
  );
}
