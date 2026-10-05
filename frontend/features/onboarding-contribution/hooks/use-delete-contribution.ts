"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  ContributionService,
} from "../services";

export function useDeleteContribution() {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn:
      ContributionService.delete,

    onSuccess: () => {

      queryClient.invalidateQueries({

        queryKey: [
          "onboarding-contribution",
        ],

      });

    },

  });

}