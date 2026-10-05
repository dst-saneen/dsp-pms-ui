"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/services/api-client";

import {
  AttendanceService,
  type AttendanceListParams,
} from "../services/attendance-service";
import type { CorrectAttendanceInput } from "../types/attendance";

export const attendanceKeys = {
  all: ["attendance"] as const,
};

export function useAttendanceList(filters?: AttendanceListParams) {
  return useQuery({
    queryKey: [...attendanceKeys.all, "list", filters ?? {}],
    queryFn: () => AttendanceService.list(filters),
  });
}

export function useCorrectAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: CorrectAttendanceInput;
    }) => AttendanceService.correct(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["attendance-exceptions"] });
      void queryClient.invalidateQueries({
        queryKey: ["attendance-regularizations"],
      });
      toast.success(
        "Attendance corrected. Related exceptions and pending proposals were cleared.",
      );
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Unable to correct attendance."));
    },
  });
}
