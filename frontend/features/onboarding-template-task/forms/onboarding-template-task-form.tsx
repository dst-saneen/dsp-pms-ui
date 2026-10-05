"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormSection, RequiredLabel } from "@/components/forms";

import {
  OwnerTypeSelect,
  WorkTypeSelect,
} from "@/features/onboarding-template/editor/canvas/task-editor/fields";
import { AssetTypeSelect } from "@/features/onboarding-template/editor/canvas/task-editor/fields/asset-type-select";

import {
  onboardingTemplateTaskSchema,
  type OnboardingTemplateTaskFormValues,
} from "../validation/onboarding-template-task-schema";

import type {
  CreateOnboardingTemplateTask,
  OnboardingTemplateTask,
} from "../types";

interface DependencyOption {
  id: string;
  taskName: string;
}

interface Props {
  templateId: string;
  taskGroupId?: string;
  sequenceNo?: number;
  versionId?: string;
  dependencyOptions?: DependencyOption[];
  task?: OnboardingTemplateTask;
  loading?: boolean;
  editing?: boolean;
  onSubmit: (values: CreateOnboardingTemplateTask) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function OnboardingTemplateTaskForm({
  taskGroupId,
  sequenceNo,
  versionId,
  dependencyOptions = [],
  task,
  loading,
  editing = false,
  onSubmit,
  onCancel,
  onDelete,
}: Props) {
  const form = useForm<OnboardingTemplateTaskFormValues>({
    resolver: zodResolver(onboardingTemplateTaskSchema),
    defaultValues: {
      taskGroupId,
      taskName: "",
      description: "",
      sequenceNo: sequenceNo ?? 1,
      isMandatory: true,
      allowSkip: false,
      allowReopen: true,
      workType: "CHECKLIST",
      ownerType: "DEPARTMENT",
    },
  });

  const isMandatory = useWatch({
    control: form.control,
    name: "isMandatory",
  });
  const allowSkip = useWatch({
    control: form.control,
    name: "allowSkip",
  });
  const allowReopen = useWatch({
    control: form.control,
    name: "allowReopen",
  });
  const workType = useWatch({
    control: form.control,
    name: "workType",
  });
  const ownerType = useWatch({
    control: form.control,
    name: "ownerType",
  });
  const referenceId = useWatch({
    control: form.control,
    name: "referenceId",
  });
  const dependsOnTaskId = useWatch({
    control: form.control,
    name: "dependsOnTaskId",
  });
  const dueDays = useWatch({
    control: form.control,
    name: "dueDays",
  });

  useEffect(() => {
    if (task) {
      form.reset({
        taskGroupId: task.taskGroupId ?? undefined,
        taskName: task.taskName,
        description: task.description ?? "",
        sequenceNo: task.sequenceNo,
        isMandatory: task.isMandatory,
        allowSkip: task.allowSkip,
        allowReopen: task.allowReopen,
        workType: task.workType === "ASSET" ? "ASSET" : "CHECKLIST",
        ownerType:
          task.ownerType === "EMPLOYEE" || task.ownerType === "MANAGER"
            ? task.ownerType
            : "DEPARTMENT",
        referenceType:
          task.referenceType === "ASSET_TYPE" ? "ASSET_TYPE" : undefined,
        referenceId: task.referenceId ?? undefined,
        dependsOnTaskId: task.dependsOnTaskId ?? undefined,
        dueDays: task.dueDays ?? undefined,
      });
    } else {
      form.reset({
        taskGroupId,
        taskName: "",
        description: "",
        sequenceNo: sequenceNo ?? 1,
        isMandatory: true,
        allowSkip: false,
        allowReopen: true,
        workType: "CHECKLIST",
        ownerType: "DEPARTMENT",
      });
    }
  }, [task, taskGroupId, sequenceNo, form]);

  const availableDependencies = dependencyOptions.filter(
    (option) => option.id !== task?.id,
  );

  return (
    <form
      onSubmit={form.handleSubmit((values) =>
        onSubmit({
          ...values,
          taskGroupId: values.taskGroupId,
          referenceType:
            values.workType === "ASSET" ? "ASSET_TYPE" : undefined,
          referenceId:
            values.workType === "ASSET" ? values.referenceId : undefined,
          dependsOnTaskId: values.dependsOnTaskId || undefined,
          dueDays:
            values.dueDays == null || Number.isNaN(values.dueDays)
              ? undefined
              : values.dueDays,
        }),
      )}
      className="space-y-5"
    >
      <FormSection title="Basic">
        <p className="text-muted-foreground -mt-2 mb-3 text-xs">
          What the task is, who owns it, and whether it is required.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <RequiredLabel required>Task Name</RequiredLabel>
            <Input
              {...form.register("taskName")}
              placeholder="e.g. Collect laptop"
            />
          </div>
          <div className="space-y-2">
            <RequiredLabel required>Sequence</RequiredLabel>
            <Input
              type="number"
              {...form.register("sequenceNo", { valueAsNumber: true })}
            />
            <p className="text-muted-foreground text-xs">
              Order inside this group (1, 2, 3…).
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Label>Description</Label>
          <Textarea
            rows={3}
            placeholder="Optional short instructions"
            {...form.register("description")}
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <RequiredLabel required>Work type</RequiredLabel>
            <WorkTypeSelect
              value={workType}
              onChange={(value) => {
                const next = value === "ASSET" ? "ASSET" : "CHECKLIST";
                form.setValue("workType", next);
                if (next === "ASSET") {
                  form.setValue("ownerType", "DEPARTMENT");
                  form.setValue("referenceType", "ASSET_TYPE");
                } else {
                  form.setValue("referenceType", undefined);
                  form.setValue("referenceId", undefined);
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <RequiredLabel required>Assigned to (owner)</RequiredLabel>
            <OwnerTypeSelect
              value={ownerType}
              onChange={(value) => {
                if (
                  value === "DEPARTMENT" ||
                  value === "EMPLOYEE" ||
                  value === "MANAGER"
                ) {
                  form.setValue("ownerType", value);
                }
              }}
            />
          </div>
        </div>
        <p className="text-muted-foreground mt-2 text-sm">
          Owner is a role type, not a named person. The real person is chosen
          when onboarding starts.
        </p>

        {workType === "ASSET" && versionId ? (
          <div className="mt-4 space-y-2">
            <RequiredLabel required>Asset type</RequiredLabel>
            <AssetTypeSelect
              versionId={versionId}
              value={referenceId}
              onChange={(assetType) => {
                form.setValue("referenceType", "ASSET_TYPE");
                form.setValue("referenceId", assetType.id);
                form.setValue("ownerType", "DEPARTMENT");
              }}
            />
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between rounded-lg border p-4">
          <div>
            <div className="font-medium">Mandatory</div>
            <div className="text-muted-foreground text-sm">
              Must be completed before onboarding can finish.
            </div>
          </div>
          <Switch
            checked={isMandatory}
            onCheckedChange={(value) => form.setValue("isMandatory", value)}
          />
        </div>
      </FormSection>

      <FormSection title="Advanced">
        <p className="text-muted-foreground -mt-2 mb-3 text-xs">
          Optional timing, skip, reopen, and dependency rules.
        </p>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <div className="font-medium">Allow skip</div>
            <div className="text-muted-foreground text-sm">
              Optional tasks only. Do not make a skippable task a dependency of
              another task.
            </div>
          </div>
          <Switch
            checked={allowSkip}
            onCheckedChange={(value) => form.setValue("allowSkip", value)}
          />
        </div>

        <div className="mt-3 flex items-center justify-between rounded-lg border p-4">
          <div>
            <div className="font-medium">Allow reopen</div>
            <div className="text-muted-foreground text-sm">
              Allow HR to reopen this task after it was completed.
            </div>
          </div>
          <Switch
            checked={allowReopen}
            onCheckedChange={(value) => form.setValue("allowReopen", value)}
          />
        </div>

        <div className="mt-4 space-y-2">
          <Label>Due after (days)</Label>
          <Input
            type="number"
            min={0}
            placeholder="Leave empty for no due date"
            value={dueDays ?? ""}
            onChange={(event) => {
              const raw = event.target.value;
              form.setValue(
                "dueDays",
                raw === "" ? undefined : Number(raw),
              );
            }}
          />
          <p className="text-muted-foreground text-xs">
            Days after onboarding start date. Example: 3 = due on day 3.
          </p>
        </div>

        <div className="mt-4 space-y-2">
          <Label>Depends on task</Label>
          <Select
            value={dependsOnTaskId ?? "__none__"}
            onValueChange={(value) =>
              form.setValue(
                "dependsOnTaskId",
                value === "__none__" ? undefined : value,
              )
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {availableDependencies.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.taskName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            This task stays blocked until the chosen task is completed.
          </p>
        </div>
      </FormSection>

      <div className="flex items-center justify-between border-t pt-6">
        <div>
          {editing && onDelete ? (
            <Button type="button" variant="destructive" onClick={onDelete}>
              Delete
            </Button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || (workType === "ASSET" && !referenceId)}
          >
            {loading ? "Saving..." : editing ? "Update" : "Save"}
          </Button>
        </div>
      </div>
    </form>
  );
}
