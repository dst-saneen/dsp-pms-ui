"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";

import { ShiftService } from "../services/shift-service";

import type { Shift } from "../types/shift";
import type { ShiftFormValues } from "../validation/shift-schema";
import type { ApiError } from "@/types/api";

type UpdateShiftVariables = {
  id: string;
  data: ShiftFormValues;
};

export function useUpdateShift() {
  const queryClient = useQueryClient();

  return useMutation<
    Shift,
    ApiError,
    UpdateShiftVariables
  >({
    mutationFn: ({ id, data }) =>
      ShiftService.update(id, data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["shifts"],
      });

      toast.success(
        "Shift updated successfully."
      );
    },

    onError: (error: ApiError) => {
      toast.error(
        error.response?.data?.message ??
          "Unable to update Shift."
      );
    },
  });
}