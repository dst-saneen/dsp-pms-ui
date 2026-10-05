"use client";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  RequirementService,
} from "./requirement.service";

import type {
  RequirementRow,
} from "../editor/canvas/task-editor/requirement/requirement-columns";

export function useUpdateRequirement() {

  const queryClient =
    useQueryClient();

  return useMutation({

    mutationFn: ({
      id,
      dto,
    }: {
      id: string;
      dto: RequirementRow;
    }) =>
      RequirementService.update(
        id,
        dto,
      ),

    onSuccess: () => {

      queryClient.invalidateQueries({

        queryKey: [
          "onboarding-requirements",
        ],

      });

    },

  });

}