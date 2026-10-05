"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";

import type { ApiError } from "@/types/api";

import { CompanyService } from "../services/company-service";

export function useDeleteCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      CompanyService.delete(id),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["companies"],
      });
      queryClient.invalidateQueries({
        queryKey: ["lookups", "companies"],
      });

      toast.success(
        "Company deleted successfully."
      );
    },

    onError: (error: ApiError) => {
      toast.error(
        error.response?.data?.message ??
        "Unable to delete Company."
      );
    },
  });
}