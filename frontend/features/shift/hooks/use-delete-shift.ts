"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";

import type { ApiError } from "@/types/api";

import { ShiftService } from "../services/shift-service";

export function useDeleteShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
        ShiftService.delete(id),

    onSuccess: () => {
    queryClient.invalidateQueries({
        queryKey: ["shifts"],
    });

    toast.success("Shift deleted successfully.");
    },

    onError: (error: ApiError) => {
      toast.error(
        error.response?.data?.message ??
          "Unable to delete Shift."
      );
    },
  });
}