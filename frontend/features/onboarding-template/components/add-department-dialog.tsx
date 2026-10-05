"use client";

import { useState } from "react";
import { toast } from "sonner";

import { FormSheet } from "@/components/common/form-sheet";
import { Button } from "@/components/ui/button";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useDepartments } from "@/features/lookups";
import { getApiErrorMessage } from "@/services/api-client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  existingDepartmentIds: string[];

  onAdd: (departmentId: string) => Promise<unknown> | unknown;
}

export function AddDepartmentDialog({
  open,
  onOpenChange,
  existingDepartmentIds,
  onAdd,
}: Props) {
  const { data: departments = [] } = useDepartments();

  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);

  const availableDepartments = departments.filter(
    (department) => !existingDepartmentIds.includes(String(department.id)),
  );

  async function handleAdd() {
    if (!selected || saving) return;
    setSaving(true);
    try {
      await onAdd(selected);
      setSelected("");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          "Could not add department to this onboarding template.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setSelected("");
        onOpenChange(next);
      }}
      title="Add Department"
      description="Add an available department to this onboarding template."
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button disabled={!selected || saving} onClick={() => void handleAdd()}>
            {saving ? "Adding…" : "Add"}
          </Button>
        </div>
      }
    >
      <Select value={selected} onValueChange={setSelected} disabled={saving}>
        <SelectTrigger>
          <SelectValue placeholder="Select Department" />
        </SelectTrigger>
        <SelectContent>
          {availableDepartments.map((department) => (
            <SelectItem key={department.id} value={String(department.id)}>
              {department.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormSheet>
  );
}
