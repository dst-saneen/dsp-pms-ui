"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";

import { CompanyService } from "../services/company-service";

import type { UpdateCompanyDto } from "../types/company";

import type { ApiError } from "@/types/api";

export function useUpdateCompany(options?: { suppressToast?: boolean }) {
  const queryClient = useQueryClient();
  const suppressToast = options?.suppressToast ?? false;

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateCompanyDto;
    }) =>
      CompanyService.update(id, data),

    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["companies"],
      });
      queryClient.invalidateQueries({
        queryKey: ["companies", "detail", variables.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["lookups", "companies"],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-readiness"],
      });

      if (suppressToast) return;
      toast.success(
        "Company updated successfully."
      );
    },

    onError: (error: ApiError) => {
      if (suppressToast) return;
      toast.error(
        error.response?.data?.message ??
        "Unable to update Company."
      );
    },
  });
}