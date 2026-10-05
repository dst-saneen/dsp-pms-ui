"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { DataTable } from "@/components/tables/data-table";

import {
  OnboardingTemplateTaskDialog,
} from "@/features/onboarding-template-task";

import { useOnboardingDesigner } from "../../state";

import type { OnboardingTaskGroup } from "@/features/onboarding-task-group";
import type { OnboardingTemplateTask } from "../../../types";

import { taskColumns } from "./task-columns";

interface TaskGroupWithTemplateId extends OnboardingTaskGroup {
  onboardingTemplateId?: string;
}

interface Props {
  taskGroup: TaskGroupWithTemplateId;
}

export function TasksSection({
  taskGroup,
}: Props) {
  const [open, setOpen] = useState(false);

  const [selectedTask, setSelectedTask] =
    useState<OnboardingTemplateTask | undefined>();

  const { dispatch } =
    useOnboardingDesigner();

  const tasks =
    taskGroup.tasks ?? [];

  return (
    <Card className="border-0 shadow-none">

      <CardHeader className="flex flex-row items-center justify-between px-0">

        <CardTitle>
          Tasks
        </CardTitle>

        <Button
          size="sm"
          onClick={() => {
            setSelectedTask(undefined);
            setOpen(true);
          }}
        >
          Add Task
        </Button>

      </CardHeader>

      <CardContent className="px-0">

        <DataTable
          columns={taskColumns()}
          data={tasks}
          onRowClick={(task) => {
            const selected = task as OnboardingTemplateTask;

            setSelectedTask(selected);

            // Keep the existing designer state
            // until we fully migrate away from node editing.
            dispatch({
              type: "SELECT_NODE",
              payload: {
                id: selected.id,
                type: "task",
                title: selected.taskName,
              },
            });

            setOpen(true);

          }}
        />

      </CardContent>

      <OnboardingTemplateTaskDialog
        open={open}
        onOpenChange={setOpen}
        templateId={taskGroup.onboardingTemplateId ?? ""}
        taskGroupId={taskGroup.id}
        sequenceNo={
          selectedTask?.sequenceNo ??
          tasks.length + 1
        }
        task={selectedTask}
      />

    </Card>
  );
}
