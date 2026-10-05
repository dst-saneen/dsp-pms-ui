"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import type { ApiError } from "@/types/api";
import type { ArchiveTaxonomyDto } from "@/features/asset-type/types/asset-type";

import { AssetCategoryService } from "../services/asset-category-service";

export function useArchiveAssetCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: ArchiveTaxonomyDto;
    }) => AssetCategoryService.archive(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-categories"] });
      toast.success("Asset category archived.");
    },
    onError: (error: ApiError) => {
      toast.error(
        error.response?.data?.message ??
          "Unable to archive asset category.",
      );
    },
  });
}
