"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  RequirementService,
} from "./requirement.service";

export function useCreateRequirement() {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn:
      RequirementService.create,

    onSuccess: () => {

      queryClient.invalidateQueries({

        queryKey: [
          "onboarding-requirements",
        ],

      });

    },

  });

}