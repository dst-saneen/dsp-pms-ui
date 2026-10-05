"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  TaskContributionService,
} from "../services/task-contribution.service";

export function useCreateTaskContribution() {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn:
      TaskContributionService.create,

    onSuccess: (_, variables) => {

      queryClient.invalidateQueries({

        queryKey: [
          "task-contributions",
          variables.taskId,
        ],

      });

    },

  });

}