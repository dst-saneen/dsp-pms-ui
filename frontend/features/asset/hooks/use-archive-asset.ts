"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import type { ApiError } from "@/types/api";

import { AssetService } from "../services/asset-service";
import type { ArchiveAssetDto } from "../types/asset";

export function useArchiveAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: ArchiveAssetDto;
    }) => AssetService.archive(id, data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["assets"],
      });
      toast.success("Asset archived.");
    },

    onError: (error: ApiError) => {
      toast.error(
        error.response?.data?.message ?? "Unable to archive asset.",
      );
    },
  });
}
