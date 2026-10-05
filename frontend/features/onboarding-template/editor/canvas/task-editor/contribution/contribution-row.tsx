"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  useDeleteTaskContribution,
} from "@/features/onboarding-contribution";

import type {
  TaskContribution,
} from "@/features/onboarding-contribution/services/task-contribution.service";

interface ContributionRowProps {
  contribution: TaskContribution;
}

export function ContributionRow({
  contribution,
}: ContributionRowProps) {

  const remove =
    useDeleteTaskContribution(
      contribution.taskId,
    );

  return (

    <div className="flex items-start justify-between rounded-md border p-4">

      <div className="space-y-1">

        <div className="font-medium">
          {contribution.contribution.contributionName}
        </div>

        <div className="text-xs text-muted-foreground">
          {contribution.contribution.contributionCode}
        </div>

        {contribution.contribution.description && (
          <div className="text-sm text-muted-foreground">
            {contribution.contribution.description}
          </div>
        )}

      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() =>
          remove.mutate(contribution.id)
        }
        disabled={remove.isPending}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

    </div>

  );

}