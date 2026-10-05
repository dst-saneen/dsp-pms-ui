"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { ExecutionRuleService } from "./execution-rule.service";

import type {
  ExecutionRuleRow,
} from "@/features/onboarding-template/editor/canvas/task-editor/execution-rule";

export function useUpdateExecutionRule() {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn: ({
      id,
      dto,
    }: {
      id: string;
      dto: ExecutionRuleRow;
    }) =>
      ExecutionRuleService.update(
        id,
        dto,
      ),

    onSuccess: () => {

      queryClient.invalidateQueries({

        queryKey: [
          "execution-rules",
        ],

      });

    },

  });

}