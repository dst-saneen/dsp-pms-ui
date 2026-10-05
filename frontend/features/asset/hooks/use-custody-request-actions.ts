"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/services/api-client";
import type { ApiError } from "@/types/api";

import { createOperationId } from "../lib/operation-id";
import { AssetService } from "../services/asset-service";
import type { CustodyRequest } from "../types/asset";

export function useCompleteCustodyRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      request,
      resolutionNote,
    }: {
      request: CustodyRequest;
      resolutionNote: string;
    }) => {
      if (!request.targetVersion || !request.assetVersion) {
        throw new Error("Request target versions are missing.");
      }
      const note = resolutionNote.trim();
      if (note.length < 3) {
        throw new Error("A real decision note is required (at least 3 characters).");
      }

      return AssetService.completeCustodyRequest(request.id, {
        operationId: createOperationId(),
        expectedRequestVersion: request.version,
        expectedTargetVersion: request.targetVersion,
        expectedAssetVersion: request.assetVersion,
        effectiveDate: new Date().toISOString().slice(0, 10),
        resolutionNote: note,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["assets", "custody-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["assets"] });
      void queryClient.invalidateQueries({ queryKey: ["employee-assets"] });
      toast.success("Request completed.");
    },
    onError: (error: ApiError) => {
      toast.error(getApiErrorMessage(error, "Could not complete request."));
    },
  });
}

export function useRejectCustodyRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      request,
      resolutionNote,
    }: {
      request: CustodyRequest;
      resolutionNote: string;
    }) => {
      const note = resolutionNote.trim();
      if (note.length < 3) {
        throw new Error("A real rejection reason is required (at least 3 characters).");
      }
      return AssetService.rejectCustodyRequest(request.id, {
        operationId: createOperationId(),
        expectedRequestVersion: request.version,
        resolutionNote: note,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["assets", "custody-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["assets"] });
      void queryClient.invalidateQueries({ queryKey: ["employee-assets"] });
      toast.success("Request rejected.");
    },
    onError: (error: ApiError) => {
      toast.error(getApiErrorMessage(error, "Could not reject request."));
    },
  });
}
