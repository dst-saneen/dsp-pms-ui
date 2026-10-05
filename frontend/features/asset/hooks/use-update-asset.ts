"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";

import { AssetService } from "../services/asset-service";

import type { UpdateAssetDto } from "../types/asset";

import type { ApiError } from "@/types/api";

export function useUpdateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateAssetDto;
    }) =>
      AssetService.update(id, data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["assets"],
      });

      toast.success(
        "Asset updated successfully."
      );
    },

    onError: (error: ApiError) => {
      toast.error(
        error.response?.data?.message ??
        "Unable to update Asset."
      );
    },
  });
}