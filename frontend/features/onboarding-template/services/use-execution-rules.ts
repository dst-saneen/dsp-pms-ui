"use client";

import { useQuery } from "@tanstack/react-query";

import { ExecutionRuleService } from "./execution-rule.service";

export function useExecutionRules(
  executionProfileId?: string,
) {

  return useQuery({

    queryKey: [

      "execution-rules",

      executionProfileId,

    ],

    enabled: !!executionProfileId,

    queryFn: () =>

      ExecutionRuleService.getByExecutionProfile(
        executionProfileId!,
      ),

  });

}