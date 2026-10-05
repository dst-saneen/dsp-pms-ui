"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type { ApiError } from "@/types/api";

import { AssetCategoryService } from "../services/asset-category-service";

export function useDeleteAssetCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
        AssetCategoryService.delete(id),

    onSuccess: () => {
        queryClient.invalidateQueries({
        queryKey: ["asset-categories"],
        });

        toast.success(
        "Asset Category deleted successfully."
        );
    },

    onError: (error: ApiError) => {
        toast.error(
        error.response?.data?.message ??
        "Unable to delete Asset Category."
        );
    },
    });
}