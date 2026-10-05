"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  ContributionService,
} from "../services";

export function useUpdateContribution() {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn: ({
      id,
      dto,
    }: {
      id: string;
      dto: Parameters<
        typeof ContributionService.update
      >[1];
    }) =>
      ContributionService.update(
        id,
        dto,
      ),

    onSuccess: () => {

      queryClient.invalidateQueries({

        queryKey: [
          "onboarding-contribution",
        ],

      });

    },

  });

}