"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";

import { ShiftService } from "../services/shift-service";

import type { ShiftFormValues } from "../validation/shift-schema";
import type { ApiError } from "@/types/api";

export function useCreateShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ShiftFormValues) =>
    ShiftService.create(data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["shifts"],
      });

      toast.success(
        "Shift created successfully."
      );
    },

    onError: (error: ApiError) => {
      toast.error(
        error.response?.data?.message ??
          "Unable to create Shift."
      );
    },
  });
}