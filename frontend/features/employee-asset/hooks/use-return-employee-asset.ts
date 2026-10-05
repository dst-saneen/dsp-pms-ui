"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { EmployeeAssetService } from "../services";
import { employeeAssetKeys } from "./query-keys";

import type { ReturnEmployeeAsset } from "../types";

export function useReturnEmployeeAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      dto,
    }: {
      id: string;
      dto: ReturnEmployeeAsset;
      employeeId: string;
    }) =>
      EmployeeAssetService.returnAsset(id, dto),

    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: employeeAssetKeys.all,
      });

      queryClient.invalidateQueries({
        queryKey: employeeAssetKeys.byEmployee(
          variables.employeeId,
        ),
      });
    },
  });
}
