"use client";

import { useState } from "react";

import { KpiCard } from "@/components/common/kpi-card";
import { KpiGrid } from "@/components/common/kpi-grid";
import { WorkspaceShell } from "@/components/common/workspace-shell";

import { OnboardingTemplateTaskDialog } from "../dialogs";

import { OnboardingTemplateTaskTable } from "./onboarding-template-task-table";

import type { OnboardingTemplateTask } from "../types";

interface Props {
  templateId: string;
}

export function OnboardingTemplateTaskWorkspace({ templateId }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<
    OnboardingTemplateTask | undefined
  >();

  return (
    <WorkspaceShell>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Template Tasks</h3>
          <p className="text-sm text-muted-foreground">
            Configure the onboarding workflow for this template.
          </p>
        </div>

        <button
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
          onClick={() => {
            setSelectedTask(undefined);
            setDialogOpen(true);
          }}
        >
          Add Task
        </button>
      </div>

      <KpiGrid columns={3}>
        <KpiCard title="Tasks" value={0} />
        <KpiCard title="Mandatory" value={0} />
        <KpiCard title="Optional" value={0} />
      </KpiGrid>

      <OnboardingTemplateTaskTable
        searchParams={{
          onboardingTemplateId: templateId,
        }}
        onSelect={(task) => {
          setSelectedTask(task);
          setDialogOpen(true);
        }}
      />

      <OnboardingTemplateTaskDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedTask(undefined);
          }
        }}
        templateId={templateId}
        task={selectedTask}
      />
    </WorkspaceShell>
  );
}
