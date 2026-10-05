"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { ExecutionRuleService } from "./execution-rule.service";

export function useDeleteExecutionRule() {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn:
      ExecutionRuleService.delete,

    onSuccess: () => {

      queryClient.invalidateQueries({

        queryKey: [
          "execution-rules",
        ],

      });

    },

  });

}