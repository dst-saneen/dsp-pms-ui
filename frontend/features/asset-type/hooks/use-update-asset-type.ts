"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { AssetTypeService } from "../services/asset-type-service";

import type {
  UpdateAssetTypeDto,
} from "../types/asset-type";

import type { ApiError } from "@/types/api";

export function useUpdateAssetType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateAssetTypeDto;
    }) =>
      AssetTypeService.update(
        id,
        data,
      ),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["asset-types"],
      });

      toast.success(
        "Asset Type updated successfully."
      );
    },

    onError: (error: ApiError) => {
      toast.error(
        error.response?.data?.message ??
        "Unable to update Asset Type."
      );
    },
  });
}