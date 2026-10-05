"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type {
  OnboardingWorkflowStage,
} from "../../types";

interface WorkflowStageCardProps {
  stage: OnboardingWorkflowStage;
}

export function WorkflowStageCard({
  stage,
}: WorkflowStageCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {stage.sequenceNo}. {stage.stageName}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {stage.ownerType}
      </CardContent>
    </Card>
  );
}