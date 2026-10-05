"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/services/api-client";

import { MeService } from "../services/me-service";
import type { CreateMyLeaveRequestInput } from "../types";

export const myWorkspaceKeys = {
  root: ["my-workspace"] as const,
  workspace: ["my-workspace", "workspace"] as const,
  leave: ["my-workspace", "leave"] as const,
  leaveForYear: (year?: number) => ["my-workspace", "leave", year ?? "current"] as const,
  leaveTypes: ["my-workspace", "leave-types"] as const,
  overtime: ["my-workspace", "overtime"] as const,
  compOff: ["my-workspace", "comp-off"] as const,
  exceptions: ["my-workspace", "exceptions"] as const,
  calendar: ["my-workspace", "calendar"] as const,
  assets: ["my-workspace", "assets"] as const,
  optionalHolidays: (year: number) => ["my-workspace", "optional-holidays", year] as const,
};

export function useMyWorkspace(enabled = true) {
  return useQuery({
    queryKey: myWorkspaceKeys.workspace,
    queryFn: () => MeService.getWorkspace(),
    enabled,
  });
}

export function useMyLeave(year?: number, enabled = true) {
  return useQuery({
    queryKey: myWorkspaceKeys.leaveForYear(year),
    queryFn: () => MeService.getLeave(year),
    enabled,
  });
}

export function useLeaveTypes() {
  return useQuery({
    queryKey: myWorkspaceKeys.leaveTypes,
    queryFn: () => MeService.listLeaveTypes(),
  });
}

export function useMyOvertime(enabled = true) {
  return useQuery({
    queryKey: myWorkspaceKeys.overtime,
    queryFn: () => MeService.getOvertime(),
    enabled,
  });
}

export function useSubmitMyOvertime() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      requestedSettlement: string;
      requestedMinutes: number;
      reason?: string;
    }) => MeService.submitOvertime(input.id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: myWorkspaceKeys.overtime });
      toast.success("Overtime submitted for approval.");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not submit overtime.")),
  });
}

export function useMyCompOff(enabled = true) {
  return useQuery({
    queryKey: myWorkspaceKeys.compOff,
    queryFn: () => MeService.getCompOff(),
    enabled,
  });
}

export function useMyAttendanceExceptions(enabled = true) {
  return useQuery({
    queryKey: myWorkspaceKeys.exceptions,
    queryFn: () => MeService.getAttendanceExceptions(),
    enabled,
  });
}

export function useSubmitMyRegularization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      attendanceId: string;
      attendanceExceptionId?: string;
      proposedCheckInAt?: string;
      proposedCheckOutAt?: string;
      reason: string;
    }) => MeService.submitRegularization(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: myWorkspaceKeys.root });
    },
  });
}

export function useMyWorkforceCalendar(fromDate: string, toDate: string, enabled = true) {
  return useQuery({
    queryKey: [...myWorkspaceKeys.calendar, fromDate, toDate],
    queryFn: () => MeService.getWorkforceCalendar(fromDate, toDate),
    enabled: enabled && Boolean(fromDate && toDate),
    staleTime: 60_000,
  });
}

export function holidayCalendarRanges(year: number) {
  return Array.from({ length: 6 }, (_, index) => {
    const startMonth = index * 2;
    return {
      fromDate: new Date(Date.UTC(year, startMonth, 1)).toISOString().slice(0, 10),
      toDate: new Date(Date.UTC(year, startMonth + 2, 0)).toISOString().slice(0, 10),
    };
  });
}

/**
 * The self-service workforce-calendar endpoint is deliberately range-limited
 * to 62 days. Fetch a selected year in six non-overlapping, two-month ranges
 * only when the employee opens the Holiday List tab.
 */
export function useMyHolidayCalendar(year: number, enabled = true) {
  const ranges = holidayCalendarRanges(year);
  const queries = useQueries({
    queries: ranges.map(({ fromDate, toDate }) => ({
      queryKey: [...myWorkspaceKeys.calendar, fromDate, toDate],
      queryFn: () => MeService.getWorkforceCalendar(fromDate, toDate),
      enabled,
      staleTime: 60_000,
    })),
  });

  return {
    data: queries.flatMap((query) => query.data?.days ?? []),
    isLoading: queries.some((query) => query.isLoading),
    isFetching: queries.some((query) => query.isFetching),
    isError: queries.some((query) => query.isError),
    error: queries.find((query) => query.error)?.error ?? null,
    refetch: async () => {
      await Promise.all(queries.map((query) => query.refetch()));
    },
  };
}

export function useAttendanceActions() {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: myWorkspaceKeys.root });

  const checkIn = useMutation({
    mutationFn: () => MeService.checkIn(),
    onSuccess: () => {
      void invalidate();
      toast.success("Checked in.");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Check-in failed."));
    },
  });

  const checkOut = useMutation({
    mutationFn: () => MeService.checkOut(),
    onSuccess: () => {
      void invalidate();
      toast.success("Checked out.");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Check-out failed."));
    },
  });

  return {
    checkIn,
    checkOut,
    errorMessage: checkIn.error
      ? getApiErrorMessage(checkIn.error, "Check-in failed.")
      : checkOut.error
        ? getApiErrorMessage(checkOut.error, "Check-out failed.")
        : null,
  };
}

export function usePreviewMyLeaveRequest() {
  return useMutation({
    mutationFn: (input: CreateMyLeaveRequestInput) => MeService.previewLeaveRequest(input),
  });
}

export function useCreateMyLeaveRequest(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateMyLeaveRequestInput & { submitNow?: boolean }) => {
      const created = (await MeService.createLeaveRequest(input)) as {
        id: string;
        requestedDays?: number | string;
      };
      if (input.submitNow !== false) {
        await MeService.submitLeaveRequest(created.id);
      }
      return created;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: myWorkspaceKeys.root });
      onSuccess?.();
    },
  });
}

export function useMyAssets(enabled = true) {
  return useQuery({
    queryKey: myWorkspaceKeys.assets,
    queryFn: () => MeService.getAssets(),
    enabled,
  });
}

export function useMyAssetActions() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: myWorkspaceKeys.assets });

  const acknowledgeAssignment = useMutation({
    mutationFn: ({ id, version }: { id: string; version?: number }) =>
      MeService.acknowledgeAssignment(id, version),
    onSuccess: invalidate,
  });

  const acknowledgeAllocation = useMutation({
    mutationFn: ({ id, version }: { id: string; version?: number }) =>
      MeService.acknowledgeAllocation(id, version),
    onSuccess: invalidate,
  });

  const createRequest = useMutation({
    mutationFn: MeService.createAssetRequest,
    onSuccess: invalidate,
  });

  return {
    acknowledgeAssignment,
    acknowledgeAllocation,
    createRequest,
  };
}
