"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/services/api-client";

import { AttendanceExceptionService } from "../services/attendance-exception-service";
import type { AttendanceExceptionFilters, AttendanceRegularizationFilters } from "../types";

export const attendanceExceptionKeys = {
  all: ["attendance-exceptions"] as const,
  regularizations: ["attendance-regularizations"] as const,
};

export function useAttendanceExceptions(filters?: AttendanceExceptionFilters) {
  return useQuery({
    queryKey: [...attendanceExceptionKeys.all, filters ?? {}],
    queryFn: () => AttendanceExceptionService.listExceptions(filters),
  });
}

export function useAttendanceRegularizations(filters?: AttendanceRegularizationFilters) {
  return useQuery({
    queryKey: [...attendanceExceptionKeys.regularizations, filters ?? {}],
    queryFn: () => AttendanceExceptionService.listRegularizations(filters),
  });
}

function useProcessRegularization(action: "approve" | "reject") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks?: string }) =>
      action === "approve"
        ? AttendanceExceptionService.approveRegularization(id, remarks)
        : AttendanceExceptionService.rejectRegularization(id, remarks),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: attendanceExceptionKeys.all,
      });
      void queryClient.invalidateQueries({
        queryKey: attendanceExceptionKeys.regularizations,
      });
      toast.success(`Regularization ${action === "approve" ? "approved" : "rejected"}.`);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, `Unable to ${action} regularization.`));
    },
  });
}

export function useApproveRegularization() {
  return useProcessRegularization("approve");
}

export function useRejectRegularization() {
  return useProcessRegularization("reject");
}

export function useCancelRegularization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => AttendanceExceptionService.cancelRegularization(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: attendanceExceptionKeys.all,
      });
      void queryClient.invalidateQueries({
        queryKey: attendanceExceptionKeys.regularizations,
      });
      toast.success("Pending propose-fix cancelled.");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Unable to cancel pending propose-fix."));
    },
  });
}

export function useSubmitRegularization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      attendanceId: string;
      attendanceExceptionId?: string;
      proposedCheckInAt?: string;
      proposedCheckOutAt?: string;
      reason: string;
    }) => AttendanceExceptionService.submitRegularization(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: attendanceExceptionKeys.all,
      });
      void queryClient.invalidateQueries({
        queryKey: attendanceExceptionKeys.regularizations,
      });
    },
  });
}
