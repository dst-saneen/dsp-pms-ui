"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { ExecutionProfileService } from "./execution-profile.service";

export function useCreateExecutionProfile() {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn:
      ExecutionProfileService.create,

    onSuccess: () => {

      queryClient.invalidateQueries({

        queryKey: [
          "onboarding-execution-profiles",
        ],

      });

    },

  });

}