"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/services/api-client";

import { LeaveTypeService } from "../services/leave-type-service";
import type { CreateLeaveTypeDto, UpdateLeaveTypeDto } from "../types/leave-type";

export const leaveTypeKeys = {
  all: ["leave-types"] as const,
};

export function useLeaveTypes(companyId?: string) {
  return useQuery({
    queryKey: [...leaveTypeKeys.all, companyId ?? "all"],
    queryFn: () => LeaveTypeService.getAll(companyId),
    enabled: Boolean(companyId),
  });
}

export function useCreateLeaveType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLeaveTypeDto) => LeaveTypeService.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: leaveTypeKeys.all });
      toast.success("Leave type created.");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Unable to create leave type."));
    },
  });
}

export function useUpdateLeaveType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLeaveTypeDto }) =>
      LeaveTypeService.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: leaveTypeKeys.all });
      toast.success("Leave type updated.");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Unable to update leave type."));
    },
  });
}

export function useDeleteLeaveType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => LeaveTypeService.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: leaveTypeKeys.all });
      toast.success("Leave type deleted.");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Unable to delete leave type."));
    },
  });
}
