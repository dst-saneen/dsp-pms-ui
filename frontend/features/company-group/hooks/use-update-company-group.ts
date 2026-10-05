"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "sonner";

import { CompanyGroupService } from "../services/company-group-service";

import type { UpdateCompanyGroupDto } from "../types/company-group";

export function useUpdateCompanyGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateCompanyGroupDto;
    }) =>
      CompanyGroupService.update(id, data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["company-groups"],
      });
      queryClient.invalidateQueries({
        queryKey: ["lookups", "company-groups"],
      });

      toast.success(
        "Company Group updated successfully",
      );
    },

    onError: () => {
      toast.error(
        "Failed to update Company Group",
      );
    },
  });
}