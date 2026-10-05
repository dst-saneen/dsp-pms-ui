"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { EmployeeAssetService } from "../services";
import { employeeAssetKeys } from "./query-keys";

import type { CreateEmployeeAsset } from "../types";

export function useCreateEmployeeAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateEmployeeAsset) =>
      EmployeeAssetService.create(dto),

    onSuccess: (_, dto) => {
      queryClient.invalidateQueries({
        queryKey: employeeAssetKeys.all,
      });

      queryClient.invalidateQueries({
        queryKey: employeeAssetKeys.byEmployee(
          dto.employeeId,
        ),
      });

      queryClient.invalidateQueries({
        queryKey: ["assets"],
      });
    },
  });
}
