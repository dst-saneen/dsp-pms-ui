"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  RequirementService,
} from "./requirement.service";

export function useDeleteRequirement() {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn:
      RequirementService.delete,

    onSuccess: () => {

      queryClient.invalidateQueries({

        queryKey: [
          "onboarding-requirements",
        ],

      });

    },

  });

}