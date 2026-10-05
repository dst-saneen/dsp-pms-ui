"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";

import { AssetCategoryService } from "../services/asset-category-service";

import type {
  CreateAssetCategoryDto,
} from "../types/asset-category";

import type { ApiError } from "@/types/api";

export function useCreateAssetCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAssetCategoryDto) =>
      AssetCategoryService.create(data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["asset-categories"],
      });

      toast.success(
        "Asset Category created successfully."
      );
    },

    onError: (error: ApiError) => {
      toast.error(
        error.response?.data?.message ??
        "Unable to create Asset Category."
      );
    },
  });
}