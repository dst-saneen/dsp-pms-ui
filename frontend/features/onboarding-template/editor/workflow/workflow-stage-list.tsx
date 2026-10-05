"use client";

import { WorkflowStageCard } from "./workflow-stage-card";

import type {
  OnboardingWorkflowStage,
} from "../../types";
import { WorkflowEmptyState } from "./workflow-empty-state";

interface WorkflowStageListProps {
  stages: OnboardingWorkflowStage[];
}

export function WorkflowStageList({
  stages,
}: WorkflowStageListProps) {
  if (stages.length === 0) {
    return <WorkflowEmptyState />;
  }

  return (
    <div className="space-y-4">
      {stages.map((stage) => (
        <WorkflowStageCard
          key={stage.id}
          stage={stage}
        />
      ))}
    </div>
  );
}