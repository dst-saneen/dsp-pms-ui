"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { WorkflowToolbar } from "./workflow-toolbar";
import { WorkflowStageList } from "./workflow-stage-list";

import type {
  OnboardingWorkflowStage,
} from "../../types";

export function OnboardingTemplateWorkflow() {
  const stages: OnboardingWorkflowStage[] = [];

  function handleAddStage() {
    // HR-0019F-03B
    // Stage dialog implementation
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Workflow Designer
        </CardTitle>
      </CardHeader>

      <CardContent>

        <WorkflowToolbar
          onAddStage={handleAddStage}
        />

        <WorkflowStageList
          stages={stages}
        />

      </CardContent>
    </Card>
  );
}