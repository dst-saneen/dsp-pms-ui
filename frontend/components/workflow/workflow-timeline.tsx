"use client";

import { WorkflowStageCard } from "./workflow-stage-card";

import type {
  WorkflowStage,
} from "./types";

interface Props {
  stages: WorkflowStage[];
}

export function WorkflowTimeline({
  stages,
}: Props) {
  if (stages.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        No workflow stages configured.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stages
        .sort(
          (a, b) =>
            a.sequence - b.sequence,
        )
        .map((stage) => (
          <WorkflowStageCard
            key={stage.id}
            stage={stage}
          />
        ))}
    </div>
  );
}