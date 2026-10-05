"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";

import type { ApiError } from "@/types/api";

import { AssetService } from "../services/asset-service";

export function useDeleteAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      AssetService.delete(id),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["assets"],
      });

      toast.success(
        "Asset deleted successfully."
      );
    },

    onError: (error: ApiError) => {
      toast.error(
        error.response?.data?.message ??
        "Unable to delete Asset."
      );
    },
  });
}