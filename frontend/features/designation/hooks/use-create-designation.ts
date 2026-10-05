"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DesignationService } from "../services/designation-service";
import type { DesignationFormValues } from "../validation/designation-schema";
import type { ApiError } from "@/types/api";
import { getApiErrorMessage } from "@/services/api-client";

function newOperationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `des-create-${Date.now()}`;
}

export function useCreateDesignation(options?: { suppressToast?: boolean }) {
  const queryClient = useQueryClient();
  const suppressToast = options?.suppressToast ?? false;

  return useMutation({
    mutationFn: async (data: DesignationFormValues) => {
      const departmentIds = [
        ...new Set(
          (data.onboardingInvolvementDepartmentIds ?? [])
            .map((id) => id.trim())
            .filter(Boolean),
        ),
      ];

      const designation = await DesignationService.create({
        companyId: data.companyId,
        designationName: data.designationName,
        level: Number.isFinite(data.level) ? data.level : undefined,
        isActive: data.isActive,
        departmentId: data.departmentId?.trim()
          ? data.departmentId.trim()
          : null,
        ...(departmentIds.length > 0
          ? {
              branchId: data.branchId,
              onboardingDepartmentIds: departmentIds,
              operationId: newOperationId(),
            }
          : {}),
      });

      return {
        designation,
        linkedCount: departmentIds.length,
      };
    },

    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["designations"] });
      queryClient.invalidateQueries({ queryKey: ["lookups", "designations"] });
      queryClient.invalidateQueries({
        queryKey: ["designation-onboarding-workspace"],
      });
      queryClient.invalidateQueries({ queryKey: ["onboarding-templates"] });

      if (suppressToast) return;

      toast.success(
        result.linkedCount > 0
          ? `Designation created and linked to ${result.linkedCount} onboarding department(s).`
          : "Designation created successfully.",
      );
    },

    onError: (error: ApiError) => {
      if (suppressToast) return;
      toast.error(getApiErrorMessage(error, "Unable to create Designation."));
    },
  });
}
