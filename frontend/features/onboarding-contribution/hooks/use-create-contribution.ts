"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  ContributionService,
} from "../services";

export function useCreateContribution() {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn:
      ContributionService.create,

    onSuccess: () => {

      queryClient.invalidateQueries({

        queryKey: [
          "onboarding-contribution",
        ],

      });

    },

  });

}