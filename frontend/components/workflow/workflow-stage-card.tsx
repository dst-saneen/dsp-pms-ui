"use client";

import {
  Card,
  CardContent,
} from "@/components/ui/card";

import { WorkflowStageBadge } from "./workflow-stage-badge";

import type {
  WorkflowStage,
} from "./types";

interface Props {
  stage: WorkflowStage;
}

export function WorkflowStageCard({
  stage,
}: Props) {
  return (
    <Card>

      <CardContent className="space-y-3 p-4">

        <div className="flex items-center justify-between">

          <div>

            <div className="font-medium">
              {stage.sequence}. {stage.name}
            </div>

            {stage.description && (
              <div className="text-sm text-muted-foreground">
                {stage.description}
              </div>
            )}

          </div>

          <WorkflowStageBadge
            status={stage.status}
          />

        </div>

      </CardContent>

    </Card>
  );
}