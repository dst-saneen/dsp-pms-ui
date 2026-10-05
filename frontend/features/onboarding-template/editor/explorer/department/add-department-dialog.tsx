"use client";

import { useState } from "react";

import { FormSheet } from "@/components/common/form-sheet";
import { Button } from "@/components/ui/button";

import { Label } from "@/components/ui/label";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useCreateOnboardingDepartment } from "@/features/onboarding-department-template";

import { useDepartments } from "@/features/department";

interface Props {
  open: boolean;

  templateId: string;

  versionId: string;

  currentDepartmentCount: number;

  onClose(): void;
}

export function AddDepartmentDialog({
  open,
  templateId,
  versionId,
  currentDepartmentCount,
  onClose,
}: Props) {
  const [departmentId, setDepartmentId] = useState("");

  const { data: departments = [], isLoading } = useDepartments();

  const createDepartment = useCreateOnboardingDepartment(templateId);

  return (
    <FormSheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title="Add Department"
      description="Add a department to this onboarding template version."
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!departmentId || createDepartment.isPending}
            onClick={async () => {
              await createDepartment.mutateAsync({
                onboardingTemplateVersionId: versionId,
                departmentId,
                displayOrder: currentDepartmentCount + 1,
                isRequired: true,
              });

              setDepartmentId("");
              onClose();
            }}
          >
            {createDepartment.isPending ? "Adding..." : "Add"}
          </Button>
        </div>
      }
    >
      <div className="space-y-2">
        <Label>Department</Label>
        <Select disabled={isLoading} value={departmentId} onValueChange={setDepartmentId}>
          <SelectTrigger>
            <SelectValue placeholder="Select Department" />
          </SelectTrigger>
          <SelectContent>
            {departments.map((department) => (
              <SelectItem key={department.id} value={department.id}>
                {department.departmentName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </FormSheet>
  );
}
