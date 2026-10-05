"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  TaskContributionService,
} from "../services/task-contribution.service";

export function useDeleteTaskContribution(
  taskId: string,
) {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn:
      TaskContributionService.delete,

    onSuccess: () => {

      queryClient.invalidateQueries({

        queryKey: [
          "task-contributions",
          taskId,
        ],

      });

    },

  });

}