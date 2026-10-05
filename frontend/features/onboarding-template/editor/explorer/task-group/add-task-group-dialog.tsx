"use client";

import { useState } from "react";

import { FormSheet } from "@/components/common/form-sheet";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { useCreateOnboardingTaskGroup } from "@/features/onboarding-task-group";

interface Props {
  open: boolean;

  templateId: string;

  departmentTemplateId: string;

  displayOrder: number;

  onClose(): void;
}

export function AddTaskGroupDialog({
  open,
  templateId,
  departmentTemplateId,
  displayOrder,
  onClose,
}: Props) {
  const [groupName, setGroupName] = useState("");

  const [description, setDescription] = useState("");

  const createTaskGroup = useCreateOnboardingTaskGroup(templateId);

  async function handleSave() {
    if (!groupName.trim()) {
      return;
    }

    await createTaskGroup.mutateAsync({
      onboardingDepartmentTemplateId: departmentTemplateId,

      groupName,

      description,

      displayOrder,

      isMandatory: true,
    });

    setGroupName("");

    setDescription("");

    onClose();
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title="Add Task Group"
      description="Create a task group for this onboarding department."
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Group Name</Label>
          <Input value={groupName} onChange={(event) => setGroupName(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Input value={description} onChange={(event) => setDescription(event.target.value)} />
        </div>
      </div>
    </FormSheet>
  );
}
