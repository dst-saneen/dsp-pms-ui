"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type { ApiError } from "@/types/api";
import { AssetCategoryService } from "../services/asset-category-service";

import type {
  UpdateAssetCategoryDto,
} from "../types/asset-category";

export function useUpdateAssetCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateAssetCategoryDto;
    }) =>
      AssetCategoryService.update(
        id,
        data,
      ),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["asset-categories"],
      });
    toast.success(
        "Asset Category updated successfully."
      );
    },

    onError: (error: ApiError) => {
        toast.error(
            error.response?.data?.message ??
            "Unable to update Asset Category."
        );
    },
  });
}