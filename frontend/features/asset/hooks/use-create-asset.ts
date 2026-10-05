"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";

import { AssetService } from "../services/asset-service";

import type { CreateAssetDto } from "../types/asset";

import type { ApiError } from "@/types/api";
import { getApiErrorCode, getApiErrorMessage } from "@/services/api-client";

function getAssetMutationMessage(error: ApiError, fallback: string): string {
  const code = getApiErrorCode(error);

  if (code === "ASSET_SENSITIVE_STORAGE_UNAVAILABLE") {
    return "Card assets cannot be created right now because secure card storage is not configured. Ask an admin to set ASSET_CARD_KEK, or skip card testing for now.";
  }

  return getApiErrorMessage(error, fallback);
}

export function useCreateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAssetDto) =>
      AssetService.create(data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["assets"],
      });

      toast.success("Created successfully.");
    },

    onError: (error: ApiError) => {
      toast.error(getAssetMutationMessage(error, "Unable to create Asset."));
    },
  });
}