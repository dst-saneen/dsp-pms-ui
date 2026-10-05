"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";

import { AssetTypeService } from "../services/asset-type-service";

import type {
  CreateAssetTypeDto,
} from "../types/asset-type";

import type { ApiError } from "@/types/api";

export function useCreateAssetType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAssetTypeDto) =>
      AssetTypeService.create(data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["asset-types"],
      });

      toast.success(
        "Asset Type created successfully."
      );
    },

    onError: (error: ApiError) => {
      toast.error(
        error.response?.data?.message ??
        "Unable to create Asset Type."
      );
    },
  });
}