"use client";

import { useState } from "react";
import { toast } from "sonner";

import { FormSheet } from "@/components/common/form-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/services/api-client";

import { useCreateOnboardingTaskGroup } from "../hooks";

interface Props {
  open: boolean;
  onClose(): void;
  templateId: string;
  departmentTemplateId: string;
  currentGroupCount: number;
}

function slugCode(name: string): string {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 24);
  return base || "GROUP";
}

export function AddTaskGroupDialog({
  open,
  onClose,
  templateId,
  departmentTemplateId,
  currentGroupCount,
}: Props) {
  const create = useCreateOnboardingTaskGroup(templateId);
  const [groupName, setGroupName] = useState("");
  const [groupCode, setGroupCode] = useState("");

  return (
    <FormSheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title="Add Task Group"
      description="A group is a folder of related tasks (for example Day 1 or IT Setup)."
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!groupName.trim() || create.isPending}
            onClick={async () => {
              const name = groupName.trim();
              try {
                await create.mutateAsync({
                  onboardingDepartmentTemplateId: departmentTemplateId,
                  groupCode: groupCode.trim() || slugCode(name),
                  groupName: name,
                  displayOrder: currentGroupCount + 1,
                  isMandatory: true,
                });
                toast.success(`Task group "${name}" added.`);
                setGroupName("");
                setGroupCode("");
                onClose();
              } catch (error) {
                toast.error(
                  getApiErrorMessage(error, "Could not add task group."),
                );
              }
            }}
          >
            {create.isPending ? "Adding..." : "Add"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Group Name</Label>
          <Input
            value={groupName}
            placeholder="e.g. Department Checklist"
            onChange={(event) => setGroupName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Group Code (optional)</Label>
          <Input
            value={groupCode}
            placeholder="Auto from name if empty"
            onChange={(event) => setGroupCode(event.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Short internal code. Leave blank to auto-create from the group name.
          </p>
        </div>
      </div>
    </FormSheet>
  );
}
