"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";

import { CompanyService } from "../services/company-service";

import type { CreateCompanyDto } from "../types/company";

import type { ApiError } from "@/types/api";

export function useCreateCompany(options?: { suppressToast?: boolean }) {
  const queryClient = useQueryClient();
  const suppressToast = options?.suppressToast ?? false;

  return useMutation({
    mutationFn: (data: CreateCompanyDto) =>
      CompanyService.create(data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["companies"],
      });
      queryClient.invalidateQueries({
        queryKey: ["lookups", "companies"],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-readiness"],
      });

      if (suppressToast) return;
      toast.success(
        "Company created successfully."
      );
    },

    onError: (error: ApiError) => {
      if (suppressToast) return;
      toast.error(
        error.response?.data?.message ??
        "Unable to create Company."
      );
    },
  });
}