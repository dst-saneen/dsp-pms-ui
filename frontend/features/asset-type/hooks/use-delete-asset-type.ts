"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import type { ApiError } from "@/types/api";

import { AssetTypeService } from "../services/asset-type-service";

export function useDeleteAssetType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      AssetTypeService.delete(id),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["asset-types"],
      });

      toast.success(
        "Asset Type deleted successfully.",
      );
    },

    onError: (error: ApiError) => {
      toast.error(
        error.response?.data?.message ??
          "Unable to delete Asset Type.",
      );
    },
  });
}