"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/services/api-client";

import { LeaveRequestService } from "../services/leave-request-service";
import type {
  LeaveApprovalQueue,
  LeaveRequest,
  LeaveRequestFilters,
} from "../types/leave-request";

export const leaveRequestKeys = {
  all: ["leave-requests"] as const,
  pending: (queue: LeaveApprovalQueue = "actionable") =>
    ["leave-requests", "pending", queue] as const,
};

export function useLeaveRequests(filters?: LeaveRequestFilters) {
  return useQuery({
    queryKey: [...leaveRequestKeys.all, "list", filters ?? {}],
    queryFn: () => LeaveRequestService.getAll(filters),
  });
}

export function usePendingLeaveApprovals(
  queue: LeaveApprovalQueue = "actionable",
) {
  return useQuery({
    queryKey: leaveRequestKeys.pending(queue),
    queryFn: () => LeaveRequestService.getPendingApprovals(queue),
  });
}

function invalidateLeaveQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: leaveRequestKeys.all });
}

export function useApproveLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks?: string }) =>
      LeaveRequestService.approve(id, remarks),
    onSuccess: (result) => {
      invalidateLeaveQueries(queryClient);
      const request = result as LeaveRequest | undefined;
      toast.success(
        request?.approvalProgress?.stage === "APPROVED"
          ? "Leave request approved."
          : "Sent to the next approver.",
      );
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Unable to approve leave request."));
    },
  });
}

export function useRejectLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks: string }) =>
      LeaveRequestService.reject(id, remarks),
    onSuccess: () => {
      invalidateLeaveQueries(queryClient);
      toast.success("Leave request rejected.");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Unable to reject leave request."));
    },
  });
}

export function useCancelLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      LeaveRequestService.cancel(id, reason),
    onSuccess: () => {
      invalidateLeaveQueries(queryClient);
      toast.success("Leave request cancelled.");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Unable to cancel leave request."));
    },
  });
}
