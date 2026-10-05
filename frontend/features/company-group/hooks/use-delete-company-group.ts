"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "sonner";

import { CompanyGroupService } from "../services/company-group-service";

export function useDeleteCompanyGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: CompanyGroupService.delete,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["company-groups"],
      });
      queryClient.invalidateQueries({
        queryKey: ["lookups", "company-groups"],
      });

      toast.success(
        "Company Group deleted successfully",
      );
    },

    onError: () => {
      toast.error(
        "Failed to delete Company Group",
      );
    },
  });
}