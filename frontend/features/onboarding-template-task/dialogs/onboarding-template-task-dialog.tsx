"use client";

import { FormSheet } from "@/components/common/form-sheet";

import { OnboardingTemplateTaskForm } from "../forms/onboarding-template-task-form";

import {
  useCreateOnboardingTemplateTask,
  useUpdateOnboardingTemplateTask,
  useDeleteOnboardingTemplateTask,
} from "../hooks";

import type { OnboardingTemplateTask } from "../types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  taskGroupId?: string;
  sequenceNo?: number;
  versionId?: string;
  dependencyOptions?: Array<{ id: string; taskName: string }>;
  task?: OnboardingTemplateTask;
}

export function OnboardingTemplateTaskDialog({
  open,
  onOpenChange,
  templateId,
  taskGroupId,
  sequenceNo,
  versionId,
  dependencyOptions,
  task,
}: Props) {
  const create = useCreateOnboardingTemplateTask();
  const update = useUpdateOnboardingTemplateTask();
  const remove = useDeleteOnboardingTemplateTask();
  const editing = !!task;

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit Task" : "New Task"}
      description="Fill Basic fields first. Advanced rules are optional."
      size="md"
    >
      <OnboardingTemplateTaskForm
        templateId={templateId}
        taskGroupId={taskGroupId}
        sequenceNo={sequenceNo}
        versionId={versionId}
        dependencyOptions={dependencyOptions}
        task={task}
        editing={editing}
        loading={create.isPending || update.isPending || remove.isPending}
        onCancel={() => onOpenChange(false)}
        onDelete={() => {
          if (!task) return;
          if (!confirm(`Delete "${task.taskName}"? This cannot be undone.`)) {
            return;
          }
          remove.mutate(
            {
              id: task.id,
              expectedVersion: task.rowVersion ?? 1,
            },
            {
              onSuccess: () => onOpenChange(false),
            },
          );
        }}
        onSubmit={(values) => {
          if (editing) {
            update.mutate(
              {
                id: task!.id,
                dto: {
                  ...values,
                  expectedVersion: task!.rowVersion ?? 1,
                },
              },
              {
                onSuccess: () => onOpenChange(false),
              },
            );
          } else {
            create.mutate(values, {
              onSuccess: () => onOpenChange(false),
            });
          }
        }}
      />
    </FormSheet>
  );
}
