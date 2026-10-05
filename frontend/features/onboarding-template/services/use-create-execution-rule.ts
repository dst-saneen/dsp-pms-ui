"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { ExecutionRuleService } from "./execution-rule.service";

export function useCreateExecutionRule() {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn:
      ExecutionRuleService.create,

    onSuccess: () => {

      queryClient.invalidateQueries({

        queryKey: [
          "execution-rules",
        ],

      });

    },

  });

}