"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { ExecutionProfileService } from "./execution-profile.service";

import type {
  ExecutionProfileRow,
} from "@/features/onboarding-template/editor/canvas/task-editor/execution-profile";

export function useUpdateExecutionProfile() {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn: ({
      id,
      dto,
    }: {
      id: string;
      dto: ExecutionProfileRow;
    }) =>
      ExecutionProfileService.update(
        id,
        dto,
      ),

    onSuccess: () => {

      queryClient.invalidateQueries({

        queryKey: [
          "onboarding-execution-profiles",
        ],

      });

    },

  });

}