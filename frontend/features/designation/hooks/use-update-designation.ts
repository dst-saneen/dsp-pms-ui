"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DesignationService } from "../services/designation-service";
import {
  getDesignationOnboardingDepartmentIds,
  type Designation,
} from "../types/designation";
import type { DesignationFormValues } from "../validation/designation-schema";

import type { ApiError } from "@/types/api";
import { getApiErrorMessage } from "@/services/api-client";

function newOperationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `des-update-${Date.now()}`;
}

export function useUpdateDesignation(options?: { suppressToast?: boolean }) {
  const queryClient = useQueryClient();
  const suppressToast = options?.suppressToast ?? false;

  return useMutation({
    mutationFn: async ({
      id,
      data,
      existing,
    }: {
      id: string;
      data: DesignationFormValues;
      existing: Designation;
    }) => {
      const departmentIds = [
        ...new Set(
          (data.onboardingInvolvementDepartmentIds ?? [])
            .map((departmentId) => departmentId.trim())
            .filter(Boolean),
        ),
      ];
      const previousIds = getDesignationOnboardingDepartmentIds(existing);
      const previousSet = new Set(previousIds);
      const nextSet = new Set(departmentIds);
      const linkedCount = departmentIds.filter(
        (departmentId) => !previousSet.has(departmentId),
      ).length;
      const removedCount = previousIds.filter(
        (departmentId) => !nextSet.has(departmentId),
      ).length;
      const onboardingChanged = linkedCount > 0 || removedCount > 0;

      const designation = await DesignationService.update(id, {
        designationName: data.designationName,
        level: Number.isFinite(data.level) ? data.level : undefined,
        isActive: data.isActive,
        departmentId: data.departmentId?.trim()
          ? data.departmentId.trim()
          : null,
        ...(onboardingChanged
          ? {
              branchId: data.branchId || undefined,
              onboardingDepartmentIds: departmentIds,
              operationId: newOperationId(),
            }
          : {}),
      });

      return {
        designation,
        linkedCount,
        removedCount,
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

      if (result.linkedCount > 0 || result.removedCount > 0) {
        toast.success(
          `Designation updated (${result.linkedCount} department(s) added, ${result.removedCount} removed).`,
        );
        return;
      }

      toast.success("Designation updated successfully.");
    },

    onError: (error: ApiError) => {
      if (suppressToast) return;
      toast.error(getApiErrorMessage(error, "Unable to update Designation."));
    },
  });
}
