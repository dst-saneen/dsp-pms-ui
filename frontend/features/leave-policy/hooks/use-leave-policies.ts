"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/services/api-client";

import { LeavePolicyService } from "../services/leave-policy-service";
import type {
  CreateLeavePolicyDto,
  ReplaceLeavePolicyMatrixDto,
  UpdateLeavePolicyDto,
} from "../types/leave-policy";

export const leavePolicyKeys = {
  all: ["leave-policies"] as const,
};

export function useLeavePolicies(filters?: {
  companyId?: string;
  branchId?: string;
  leaveTypeId?: string;
}) {
  return useQuery({
    queryKey: [...leavePolicyKeys.all, filters ?? {}],
    queryFn: () => LeavePolicyService.getAll(filters),
  });
}

export function useCreateLeavePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLeavePolicyDto) => LeavePolicyService.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: leavePolicyKeys.all });
      toast.success("Leave policy created.");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Unable to create leave policy."));
    },
  });
}

export function useUpdateLeavePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLeavePolicyDto }) =>
      LeavePolicyService.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: leavePolicyKeys.all });
      toast.success("Leave policy updated.");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Unable to update leave policy."));
    },
  });
}

export function useUpdateLeaveTypeCarryForward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      policyIds,
      carryForwardLimit,
    }: {
      policyIds: string[];
      carryForwardLimit: number;
    }) =>
      LeavePolicyService.updateCarryForwardForPolicies(
        policyIds,
        carryForwardLimit,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: leavePolicyKeys.all });
      toast.success("Carry-over days updated for this leave type.");
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Unable to update carry forward."),
      );
    },
  });
}

export function useLeavePolicyMatrix(filters?: {
  branchId?: string;
  departmentId?: string;
}) {
  return useQuery({
    queryKey: [...leavePolicyKeys.all, "matrix", filters ?? {}],
    queryFn: () =>
      LeavePolicyService.getMatrix({
        branchId: filters?.branchId as string,
        departmentId: filters?.departmentId,
      }),
    enabled: Boolean(filters?.branchId),
  });
}

export function useReplaceLeavePolicyMatrix() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ReplaceLeavePolicyMatrixDto) =>
      LeavePolicyService.replaceMatrix(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: leavePolicyKeys.all });
      toast.success("Leave matrix saved. Existing balances were not updated.");
    },
    onError: (error) => {
      const code =
        axios.isAxiosError(error) &&
        typeof error.response?.data === "object" &&
        error.response.data &&
        "code" in error.response.data
          ? String((error.response.data as { code?: string }).code)
          : "";
      if (code === "STALE_POLICY_MATRIX") {
        toast.error("This matrix changed since you loaded it. Reloading.");
        void queryClient.invalidateQueries({ queryKey: leavePolicyKeys.all });
        return;
      }
      toast.error(getApiErrorMessage(error, "Unable to save leave matrix."));
    },
  });
}

export function useDeleteLeavePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => LeavePolicyService.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: leavePolicyKeys.all });
      toast.success("Leave policy deleted.");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Unable to delete leave policy."));
    },
  });
}
