"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { ExecutionProfileService } from "./execution-profile.service";

export function useDeleteExecutionProfile() {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn:
      ExecutionProfileService.delete,

    onSuccess: () => {

      queryClient.invalidateQueries({

        queryKey: [
          "onboarding-execution-profiles",
        ],

      });

    },

  });

}