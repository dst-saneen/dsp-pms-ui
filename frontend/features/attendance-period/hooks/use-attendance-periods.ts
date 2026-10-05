"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/services/api-client";

import { AttendancePeriodService } from "../services/attendance-period-service";
import { AttendanceExceptionService } from "@/features/attendance-exception/services/attendance-exception-service";
import type {
  AttendancePeriod,
  AttendancePeriodAction,
  AttendancePeriodFilters,
  AttendancePeriodTransitionInput,
  CreateAttendancePeriodInput,
} from "../types";

function dateKey(value: string) {
  return value.slice(0, 10);
}

export const attendancePeriodKeys = {
  all: ["attendance-periods"] as const,
};

export function useAttendancePeriods(filters?: AttendancePeriodFilters) {
  return useQuery({
    queryKey: [...attendancePeriodKeys.all, filters ?? {}],
    queryFn: () => AttendancePeriodService.list(filters),
  });
}

export function useCreateAttendancePeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAttendancePeriodInput) => AttendancePeriodService.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: attendancePeriodKeys.all });
      toast.success("Attendance period created.");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Unable to create attendance period.")),
  });
}

export function useTransitionAttendancePeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      input,
    }: {
      id: string;
      action: AttendancePeriodAction;
      input: AttendancePeriodTransitionInput;
    }) => AttendancePeriodService.transition(id, action, input),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: attendancePeriodKeys.all });
      toast.success(`Attendance period ${variables.action.replaceAll("-", " ")} complete.`);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Unable to transition attendance period.")),
  });
}

export function usePeriodLockBlockers(period: AttendancePeriod | null) {
  const [missingCheckIn, missingCheckOut, submittedRegularizations] = useQueries({
    queries: [
      {
        queryKey: ["attendance-exceptions", "lock-blockers", period?.id, "MISSING_CHECK_IN"],
        queryFn: () =>
          AttendanceExceptionService.listExceptions({
            branchId: period?.branchId,
            status: "OPEN",
            type: "MISSING_CHECK_IN",
          }),
        enabled: Boolean(period),
      },
      {
        queryKey: ["attendance-exceptions", "lock-blockers", period?.id, "MISSING_CHECK_OUT"],
        queryFn: () =>
          AttendanceExceptionService.listExceptions({
            branchId: period?.branchId,
            status: "OPEN",
            type: "MISSING_CHECK_OUT",
          }),
        enabled: Boolean(period),
      },
      {
        queryKey: ["attendance-regularizations", "lock-blockers", period?.id],
        queryFn: () =>
          AttendanceExceptionService.listRegularizations({ status: "SUBMITTED" }),
        enabled: Boolean(period),
      },
    ],
  });

  const inPeriod = <T extends { businessDate?: string; attendance?: { attendanceDate: string } | null }>(
    item: T,
  ) => {
    if (!period) return false;
    const date = item.businessDate ?? item.attendance?.attendanceDate;
    return Boolean(
      date &&
        dateKey(date) >= dateKey(period.periodStart) &&
        dateKey(date) <= dateKey(period.periodEnd),
    );
  };

  const openMissingCheckIns = (missingCheckIn.data ?? []).filter(inPeriod);
  const openMissingCheckOuts = (missingCheckOut.data ?? []).filter(inPeriod);
  const submitted = (submittedRegularizations.data ?? []).filter(
    (item) => item.branchId === period?.branchId && inPeriod(item),
  );

  return {
    missingCount: openMissingCheckIns.length + openMissingCheckOuts.length,
    submittedCount: submitted.length,
    isLoading:
      missingCheckIn.isLoading ||
      missingCheckOut.isLoading ||
      submittedRegularizations.isLoading,
    error:
      missingCheckIn.error ??
      missingCheckOut.error ??
      submittedRegularizations.error ??
      null,
  };
}
