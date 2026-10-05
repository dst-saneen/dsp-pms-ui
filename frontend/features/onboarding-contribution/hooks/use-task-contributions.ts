"use client";

import { useQuery } from "@tanstack/react-query";

import { TaskContributionService } from "../services/task-contribution.service";

export function useTaskContributions(
  taskId?: string,
) {

  return useQuery({

    enabled: !!taskId,

    queryKey: [
      "task-contributions",
      taskId,
    ],

    queryFn: () =>
      TaskContributionService.getByTask(
        taskId!,
      ),

  });

}