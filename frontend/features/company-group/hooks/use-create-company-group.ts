"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "sonner";

import { CompanyGroupService } from "../services/company-group-service";

export function useCreateCompanyGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: CompanyGroupService.create,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["company-groups"],
      });
      queryClient.invalidateQueries({
        queryKey: ["lookups", "company-groups"],
      });

      toast.success(
        "Company Group created successfully",
      );
    },

    onError: () => {
      toast.error(
        "Failed to create Company Group",
      );
    },
  });
}