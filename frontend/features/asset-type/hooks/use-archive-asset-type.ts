"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import type { ApiError } from "@/types/api";
import type { ArchiveTaxonomyDto } from "@/features/asset-type/types/asset-type";

import { AssetTypeService } from "../services/asset-type-service";

export function useArchiveAssetType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: ArchiveTaxonomyDto;
    }) => AssetTypeService.archive(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-types"] });
      toast.success("Asset type archived.");
    },
    onError: (error: ApiError) => {
      toast.error(
        error.response?.data?.message ?? "Unable to archive asset type.",
      );
    },
  });
}
